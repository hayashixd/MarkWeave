/**
 * AiTextAssist.tsx
 *
 * テキスト選択時のAIアシスト機能。
 * ai-design.md §11 に準拠。
 *
 * 選択テキストに対して改善・翻訳・要約・校正を実行し、
 * 結果をフローティングパネルで表示する。
 *
 * Note: Phase 7 では外部API呼び出しではなくローカル処理で実装。
 * 将来的にClaude API等に接続可能な設計。
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ProgressBar } from '../common/ProgressBar';

export type AiAssistAction = 'improve' | 'translate' | 'summarize' | 'proofread';

interface AiTextAssistProps {
  /** 選択中のテキスト */
  selectedText: string;
  /** 結果テキストをエディタに挿入するコールバック */
  onReplace: (text: string) => void;
  /** パネルを閉じるコールバック */
  onClose: () => void;
  /** 表示位置 */
  position: { top: number; left: number };
}

interface ActionDef {
  id: AiAssistAction;
  label: string;
  icon: string;
  description: string;
}

const ACTIONS: ActionDef[] = [
  { id: 'improve', label: '改善', icon: '✨', description: '文章を改善する' },
  { id: 'translate', label: '翻訳', icon: '🌐', description: '英語⇔日本語翻訳' },
  { id: 'summarize', label: '要約', icon: '📝', description: 'テキストを要約する' },
  { id: 'proofread', label: '校正', icon: '🔍', description: '誤字脱字をチェック' },
];

/**
 * ローカル文章処理（外部API不要）
 * 将来的にはClaude API呼び出しに置換可能。
 */
function processText(text: string, action: AiAssistAction): string {
  switch (action) {
    case 'improve': {
      // 基本的な文章改善: 連続空白削除、句読点統一
      let result = text;
      result = result.replace(/\u3000/g, ' '); // 全角スペース→半角
      result = result.replace(/ {2,}/g, ' '); // 連続スペース→1つ
      result = result.replace(/。{2,}/g, '。'); // 連続句点→1つ
      result = result.replace(/、{2,}/g, '、'); // 連続読点→1つ
      result = result.replace(/\n{3,}/g, '\n\n'); // 3連続改行→2改行
      return result;
    }
    case 'translate': {
      // 日英判定→ヒント付与（実際の翻訳はAPI接続時に実装）
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
      if (hasJapanese) {
        return `[翻訳候補: 日本語→英語]\n\n原文:\n${text}\n\n※ AI API キーを設定すると自動翻訳が利用できます`;
      }
      return `[翻訳候補: English→日本語]\n\n原文:\n${text}\n\n※ AI API キーを設定すると自動翻訳が利用できます`;
    }
    case 'summarize': {
      // 簡易要約: 文分割→先頭文抽出
      const sentences = text.split(/(?<=[。．！？\n])/);
      const validSentences = sentences.filter((s) => s.trim().length > 0);
      if (validSentences.length <= 2) return text;
      const limit = Math.max(2, Math.ceil(validSentences.length * 0.3));
      return validSentences.slice(0, limit).join('').trim();
    }
    case 'proofread': {
      // 基本的な校正チェック
      const issues: string[] = [];
      // 全角英数字の検出
      if (/[Ａ-Ｚａ-ｚ０-９]/.test(text)) {
        issues.push('全角英数字が含まれています（半角を推奨）');
      }
      // 連続する同じ助詞の検出
      if (/(.)[がのをにへとでや]\1[がのをにへとでや]/.test(text)) {
        issues.push('同じ助詞が連続している箇所があります');
      }
      // 空白の不整合
      if (/[a-zA-Z][ぁ-ん]|[ぁ-ん][a-zA-Z]/.test(text)) {
        issues.push('英単語と日本語の間にスペースがない箇所があります');
      }

      if (issues.length === 0) {
        return '校正結果: 問題は見つかりませんでした。';
      }
      return `校正結果:\n${issues.map((i) => `- ${i}`).join('\n')}`;
    }
    default:
      return text;
  }
}

export const AiTextAssist: React.FC<AiTextAssistProps> = ({
  selectedText,
  onReplace,
  onClose,
  position,
}) => {
  const [result, setResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeAction, setActiveAction] = useState<AiAssistAction | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleAction = useCallback(
    (action: AiAssistAction) => {
      setProcessing(true);
      setActiveAction(action);
      // 非同期処理をシミュレート（将来のAPI呼び出し対応）
      setTimeout(() => {
        const processed = processText(selectedText, action);
        setResult(processed);
        setProcessing(false);
      }, 100);
    },
    [selectedText],
  );

  const handleApply = useCallback(() => {
    if (result) {
      onReplace(result);
      onClose();
    }
  }, [result, onReplace, onClose]);

  // 外部クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="ai-text-assist"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 1000,
      }}
      role="dialog"
      aria-label="AI テキストアシスト"
    >
      <div className="ai-text-assist__header">
        <span className="ai-text-assist__title">AI アシスト</span>
        <button className="ai-text-assist__close" onClick={onClose} aria-label="閉じる">
          &times;
        </button>
      </div>

      <div className="ai-text-assist__actions">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            className={`ai-text-assist__action-btn${activeAction === action.id ? ' ai-text-assist__action-btn--active' : ''}`}
            onClick={() => handleAction(action.id)}
            disabled={processing}
            title={action.description}
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {processing && (
        <div className="ai-text-assist__loading">
          <ProgressBar indeterminate label="AI処理を実行中" />
        </div>
      )}

      {result && !processing && (
        <div className="ai-text-assist__result">
          <div className="ai-text-assist__result-label">結果:</div>
          <pre className="ai-text-assist__result-text">{result}</pre>
          <div className="ai-text-assist__result-actions">
            <button
              className="ai-text-assist__btn ai-text-assist__btn--secondary"
              onClick={() => {
                navigator.clipboard.writeText(result);
              }}
            >
              コピー
            </button>
            {activeAction !== 'proofread' && (
              <button
                className="ai-text-assist__btn ai-text-assist__btn--primary"
                onClick={handleApply}
              >
                置換
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AiTextAssist;
