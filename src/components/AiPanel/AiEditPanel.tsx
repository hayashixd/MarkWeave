/**
 * AiEditPanel.tsx
 *
 * AI インライン編集パネル（ai-edit-design.md §6 準拠）。
 * エディタ下部に表示され、テンプレート選択・追加指示入力・実行・diff プレビューを提供する。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAiEditStore } from '../../store/aiEditStore';
import {
  autoSelectTemplate,
  buildPrompt,
  validateBudget,
  computeInlineDiff,
  startAiStream,
  cancelAiStream,
  listenAiStream,
} from '../../ai/edit';
import type { AiEditTemplate } from '../../ai/edit/types';
import { AiEditDiffPreview } from './AiEditDiffPreview';

interface AiEditPanelProps {
  templates: AiEditTemplate[];
  /** 初期選択テンプレート ID（指定時、autoSelect より優先） */
  initialTemplateId?: string;
  /** エディタのドキュメント全文（Markdown） */
  documentText: string;
  /** 選択中のテキスト（なければ空文字列） */
  selectionText: string;
  /** 選択範囲の開始位置 */
  selectionFrom: number;
  /** 選択範囲の終了位置 */
  selectionTo: number;
  /** カーソルがドキュメント末尾付近にあるか */
  cursorAtEnd: boolean;
  /** Accept 時のコールバック */
  onAccept: (text: string, from: number, to: number) => void;
  /** パネルを閉じるコールバック */
  onClose: () => void;
}

export const AiEditPanel: React.FC<AiEditPanelProps> = ({
  templates,
  initialTemplateId,
  documentText,
  selectionText,
  selectionFrom,
  selectionTo,
  cursorAtEnd,
  onAccept,
  onClose,
}) => {
  const streamState = useAiEditStore((s) => s.streamState);
  const accumulated = useAiEditStore((s) => s.accumulated);
  const error = useAiEditStore((s) => s.error);
  const inputTokens = useAiEditStore((s) => s.inputTokens);
  const outputTokens = useAiEditStore((s) => s.outputTokens);
  const references = useAiEditStore((s) => s.references);
  const advancedMode = useAiEditStore((s) => s.advancedMode);

  const startStream = useAiEditStore((s) => s.startStream);
  const updateAccumulated = useAiEditStore((s) => s.updateAccumulated);
  const finishStream = useAiEditStore((s) => s.finishStream);
  const setError = useAiEditStore((s) => s.setError);
  const resetStream = useAiEditStore((s) => s.resetStream);
  const toggleAdvancedMode = useAiEditStore((s) => s.toggleAdvancedMode);

  const [selectedTemplate, setSelectedTemplate] = useState<AiEditTemplate>(() => {
    if (initialTemplateId) {
      const found = templates.find((t) => t.id === initialTemplateId);
      if (found) return found;
    }
    return autoSelectTemplate(templates, {
      hasSelection: selectionText.length > 0,
      selectionLength: selectionText.length,
      cursorAtEnd,
    });
  });
  const [userInstruction, setUserInstruction] = useState('');
  const [activeConstraints, setActiveConstraints] = useState<boolean[]>(() =>
    selectedTemplate.constraints.map((c) => c.defaultEnabled),
  );

  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const unlistenRef = useRef<(() => void)[]>([]);

  // テンプレート切替時に制約をリセット
  const handleTemplateChange = useCallback(
    (tmpl: AiEditTemplate) => {
      setSelectedTemplate(tmpl);
      setActiveConstraints(tmpl.constraints.map((c) => c.defaultEnabled));
      resetStream();
    },
    [resetStream],
  );

  // メニューから initialTemplateId が変わったとき（パネルが開いたまま別テンプレートを指定した場合）に追従
  useEffect(() => {
    if (!initialTemplateId) return;
    const tmpl = templates.find((t) => t.id === initialTemplateId);
    if (tmpl && tmpl.id !== selectedTemplate.id) {
      handleTemplateChange(tmpl);
    }
    // initialTemplateId が変わったときだけ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplateId]);

  // コンテキスト予算の検証
  const budgetValidation = useMemo(() => {
    const prompt = buildPrompt({
      template: selectedTemplate,
      document: documentText,
      selection: selectionText || undefined,
      userInstruction: userInstruction || undefined,
      references,
      activeConstraints,
    });
    // Claude のコンテキスト上限（200K）
    return validateBudget(prompt, 4096, 200_000);
  }, [selectedTemplate, documentText, selectionText, userInstruction, references, activeConstraints]);

  const referencesTokens = useMemo(
    () => references.reduce((sum, r) => sum + r.estimatedTokens, 0),
    [references],
  );

  // 実行
  const handleExecute = useCallback(async () => {
    // プロバイダ・モデルは Rust 側のホワイトリストで管理。
    // 将来的に設定 UI から選択可能にするが、v1 は Anthropic 固定。
    const provider = 'anthropic';
    const model = 'claude-sonnet-4-5';

    const prompt = buildPrompt({
      template: selectedTemplate,
      document: documentText,
      selection: selectionText || undefined,
      userInstruction: userInstruction || undefined,
      references,
      activeConstraints,
    });

    const streamId = crypto.randomUUID();
    startStream(streamId);

    // リスナー登録
    const unlisteners = await listenAiStream(streamId, {
      onChunk: ({ delta, accumulated: acc }) => {
        updateAccumulated(delta, acc);
      },
      onDone: ({ content, inputTokens: inp, outputTokens: out }) => {
        finishStream(content, inp, out);
      },
      onError: (message) => {
        setError(message);
      },
    });
    unlistenRef.current = unlisteners;

    try {
      await startAiStream({
        provider,
        model,
        system: prompt.system,
        user: prompt.user,
        maxTokens: 4096,
        streamId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [
    selectedTemplate, documentText, selectionText, userInstruction,
    references, activeConstraints, startStream, updateAccumulated,
    finishStream, setError,
  ]);

  // キャンセル
  const handleCancel = useCallback(async () => {
    const streamId = useAiEditStore.getState().streamId;
    if (streamId) {
      await cancelAiStream(streamId);
    }
  }, []);

  // Accept
  const handleAccept = useCallback(() => {
    if (accumulated) {
      onAccept(accumulated, selectionFrom, selectionTo);
    }
    onClose();
  }, [accumulated, selectionFrom, selectionTo, onAccept, onClose]);

  // Reject / Close
  const handleReject = useCallback(() => {
    resetStream();
    onClose();
  }, [resetStream, onClose]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      for (const unlisten of unlistenRef.current) {
        unlisten();
      }
    };
  }, []);

  // Ctrl+Enter で実行、Escape で閉じる（IME ガード付き）
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (streamState === 'idle' || streamState === 'error') {
          handleExecute();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleReject();
      }
    },
    [streamState, handleExecute, handleReject],
  );

  // diff セグメント
  const diffSegments = useMemo(() => {
    if (streamState !== 'done' || !accumulated) return [];
    const original = selectionText || '';
    return computeInlineDiff(original, accumulated);
  }, [streamState, accumulated, selectionText]);

  // フォーカス
  useEffect(() => {
    instructionRef.current?.focus();
  }, []);

  return (
    <div
      className="ai-edit-panel border-t border-gray-200 bg-white"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="AI 編集"
    >
      {/* テンプレート選択ボタン */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100">
        {templates.map((tmpl) => (
          <button
            key={tmpl.id}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              selectedTemplate.id === tmpl.id
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => handleTemplateChange(tmpl)}
            disabled={streamState === 'streaming'}
          >
            {tmpl.name}
          </button>
        ))}
        <div className="flex-1" />
        <button
          className="text-xs text-gray-400 hover:text-gray-600"
          onClick={toggleAdvancedMode}
        >
          {advancedMode ? '簡易表示' : '詳細設定'}
        </button>
      </div>

      {/* 詳細設定（トグル） */}
      {advancedMode && (
        <div className="px-3 py-2 border-b border-gray-100 text-xs space-y-2">
          <div>
            <label className="text-gray-500 block mb-1">ペルソナ:</label>
            <textarea
              className="w-full border border-gray-200 rounded px-2 py-1 text-xs resize-none"
              rows={2}
              value={selectedTemplate.persona}
              readOnly={selectedTemplate.source === 'builtin'}
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">制約:</label>
            {selectedTemplate.constraints.map((c, i) => (
              <label key={i} className="flex items-center gap-1.5 text-gray-600 mb-0.5">
                <input
                  type="checkbox"
                  checked={activeConstraints[i] ?? c.defaultEnabled}
                  onChange={() => {
                    const next = [...activeConstraints];
                    next[i] = !next[i];
                    setActiveConstraints(next);
                  }}
                  className="rounded"
                />
                {c.text}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 追加の指示入力 */}
      <div className="px-3 py-2">
        <textarea
          ref={instructionRef}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm resize-none placeholder-gray-400 focus:outline-none focus:border-blue-300"
          rows={2}
          placeholder="追加の指示（任意）"
          value={userInstruction}
          onChange={(e) => setUserInstruction(e.target.value)}
          disabled={streamState === 'streaming'}
        />
      </div>

      {/* ストリーミング中の表示 */}
      {streamState === 'streaming' && (
        <div className="px-3 py-2 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-1">生成中...</div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto bg-gray-50 rounded p-2">
            {accumulated}
          </pre>
        </div>
      )}

      {/* エラー表示 */}
      {streamState === 'error' && error && (
        <div className="px-3 py-2 border-t border-red-100 bg-red-50">
          <div className="text-xs text-red-600">{error}</div>
        </div>
      )}

      {/* diff プレビュー */}
      {streamState === 'done' && diffSegments.length > 0 && (
        <AiEditDiffPreview segments={diffSegments} />
      )}

      {/* フッター */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-200">
        {/* 参考資料サマリー */}
        {references.length > 0 && (
          <span className="text-xs text-gray-400">
            参考資料: {references.length}件 ({referencesTokens.toLocaleString()} tok)
          </span>
        )}

        {/* 予算警告 */}
        {budgetValidation.message && (
          <span
            className={`text-xs ${
              budgetValidation.level === 'red'
                ? 'text-red-500'
                : budgetValidation.level === 'orange'
                ? 'text-orange-500'
                : 'text-yellow-600'
            }`}
          >
            {budgetValidation.message}
          </span>
        )}

        {/* トークン使用量 */}
        {(inputTokens > 0 || outputTokens > 0) && (
          <span className="text-xs text-gray-400">
            {inputTokens.toLocaleString()} + {outputTokens.toLocaleString()} tok
          </span>
        )}

        <div className="flex-1" />

        {/* アクションボタン */}
        {streamState === 'streaming' && (
          <button
            className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            onClick={handleCancel}
          >
            キャンセル
          </button>
        )}

        {streamState === 'done' && (
          <>
            <button
              className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              onClick={handleReject}
            >
              破棄
            </button>
            <button
              className="px-3 py-1 text-xs text-white bg-blue-500 hover:bg-blue-600 rounded"
              onClick={handleAccept}
            >
              適用
            </button>
          </>
        )}

        {(streamState === 'idle' || streamState === 'error') && (
          <>
            <button
              className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              onClick={handleReject}
            >
              閉じる
            </button>
            <button
              className="px-3 py-1 text-xs text-white bg-blue-500 hover:bg-blue-600 rounded disabled:opacity-50"
              onClick={handleExecute}
              disabled={!budgetValidation.ok}
            >
              実行 (Ctrl+Enter)
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AiEditPanel;
