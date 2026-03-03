/**
 * useConvertFile - ファイル形式変換フック
 *
 * html-editing-design.md §5.3 に準拠。
 * HTML ↔ Markdown の相互変換を提供する。
 *
 * 「別名で保存 → Markdownとして保存」「別名で保存 → HTMLとして保存」
 * および「変換結果を新規タブで開く」の3つのユースケースに対応。
 */

import { useCallback, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { useTabStore } from '../store/tabStore';
import { useToastStore } from '../store/toastStore';
import { writeFile } from '../lib/tauri-commands';
import { convertHtmlToMd, detectLoss } from '../core/converter/html-to-md';
import { convertMdToHtml, extractTitle } from '../core/converter/md-to-html';
import type { ConversionWarning } from '../core/converter/html-to-md';
import type { ConversionDirection } from '../components/Conversion/ConversionDialog';

const MARKDOWN_FILTER = {
  name: 'Markdown',
  extensions: ['md', 'markdown'],
};

const HTML_FILTER = {
  name: 'HTML',
  extensions: ['html', 'htm'],
};

export interface ConversionState {
  /** ダイアログが開いているか */
  isOpen: boolean;
  /** 変換方向 */
  direction: ConversionDirection;
  /** 検出された警告 */
  warnings: ConversionWarning[];
  /** 変換中フラグ */
  isConverting: boolean;
}

const initialState: ConversionState = {
  isOpen: false,
  direction: 'html-to-md',
  warnings: [],
  isConverting: false,
};

export function useConvertFile() {
  const [state, setState] = useState<ConversionState>(initialState);
  const { getActiveTab, addTab } = useTabStore();
  const show = useToastStore((s) => s.show);

  /**
   * 「Markdownとして保存」を開始する。
   * HTMLタブでのみ有効。変換ロスを検出してダイアログを表示する。
   */
  const startSaveAsMarkdown = useCallback(() => {
    const tab = getActiveTab();
    if (!tab) return;

    if (tab.fileType !== 'html') {
      show('warning', 'このファイルは既に Markdown 形式です。');
      return;
    }

    const warnings = detectLoss(tab.content);
    setState({
      isOpen: true,
      direction: 'html-to-md',
      warnings,
      isConverting: false,
    });
  }, [getActiveTab, show]);

  /**
   * 「HTMLとして保存」を開始する。
   * MarkdownタブのみMD→HTML変換ダイアログを表示する。
   * HTMLタブの場合は通常の「名前を付けて保存」と同じ動作。
   */
  const startSaveAsHtml = useCallback(() => {
    const tab = getActiveTab();
    if (!tab) return;

    if (tab.fileType === 'html') {
      show('warning', 'このファイルは既に HTML 形式です。通常の「名前を付けて保存」を使用してください。');
      return;
    }

    // MD→HTML は基本的にロスレスなので警告は空
    setState({
      isOpen: true,
      direction: 'md-to-html',
      warnings: [],
      isConverting: false,
    });
  }, [getActiveTab, show]);

  /**
   * ダイアログを閉じる。
   */
  const closeDialog = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * 変換してファイルに保存する。
   */
  const convertAndSave = useCallback(async () => {
    const tab = getActiveTab();
    if (!tab) return;

    setState((s) => ({ ...s, isConverting: true }));

    try {
      let convertedContent: string;
      let defaultExt: string;
      let filter: { name: string; extensions: string[] };

      if (state.direction === 'html-to-md') {
        // HTML → Markdown
        const result = convertHtmlToMd(tab.content);
        convertedContent = result.markdown;
        defaultExt = '.md';
        filter = MARKDOWN_FILTER;
      } else {
        // Markdown → HTML (スタイル付きスタンドアロン HTML)
        const title = extractTitle(tab.content) || tab.fileName.replace(/\.(md|markdown)$/i, '') || 'Document';
        convertedContent = await convertMdToHtml(tab.content, {
          title,
          inlineCss: true,
          highlight: true,
          math: true,
        });
        defaultExt = '.html';
        filter = HTML_FILTER;
      }

      // 保存ダイアログ表示
      let outputPath: string | null = null;
      try {
        const defaultName = tab.filePath
          ? tab.filePath.replace(/\.(md|markdown|html|htm)$/i, defaultExt)
          : `${tab.fileName}${defaultExt}`;
        outputPath = await save({
          filters: [filter],
          defaultPath: defaultName,
        });
      } catch {
        // Tauri 外ではフォールバック
        outputPath = `converted${defaultExt}`;
      }

      if (!outputPath) {
        setState((s) => ({ ...s, isConverting: false }));
        return;
      }

      // 拡張子が付いていない場合は自動付与
      if (!outputPath.match(/\.(md|markdown|html|htm)$/i)) {
        outputPath = `${outputPath}${defaultExt}`;
      }

      await writeFile(outputPath, convertedContent);

      const fileName = outputPath.split(/[/\\]/).pop() ?? outputPath;
      show('info', `「${fileName}」として保存しました。`);
      closeDialog();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      show('error', `変換に失敗しました: ${detail}`);
      setState((s) => ({ ...s, isConverting: false }));
    }
  }, [getActiveTab, state.direction, show, closeDialog]);

  /**
   * 変換して新規タブで開く。ファイルには保存しない。
   */
  const convertAndOpenTab = useCallback(async () => {
    const tab = getActiveTab();
    if (!tab) return;

    setState((s) => ({ ...s, isConverting: true }));

    try {
      let convertedContent: string;
      let newFileName: string;

      if (state.direction === 'html-to-md') {
        // HTML → Markdown
        const result = convertHtmlToMd(tab.content);
        convertedContent = result.markdown;
        newFileName = tab.fileName.replace(/\.(html|htm)$/i, '.md') ||
          `${tab.fileName}.md`;
      } else {
        // Markdown → HTML
        const title = extractTitle(tab.content) || tab.fileName.replace(/\.(md|markdown)$/i, '') || 'Document';
        convertedContent = await convertMdToHtml(tab.content, {
          title,
          inlineCss: true,
          highlight: true,
          math: true,
        });
        newFileName = tab.fileName.replace(/\.(md|markdown)$/i, '.html') ||
          `${tab.fileName}.html`;
      }

      // 新規タブとして追加（ファイルパスなし = 未保存状態）
      const targetFileType = state.direction === 'html-to-md' ? 'markdown' : 'html';
      addTab({
        filePath: null,
        fileName: newFileName,
        content: convertedContent,
        savedContent: '',
        fileType: targetFileType,
      });

      show('info', `変換結果を「${newFileName}」として新規タブで開きました。`);
      closeDialog();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      show('error', `変換に失敗しました: ${detail}`);
      setState((s) => ({ ...s, isConverting: false }));
    }
  }, [getActiveTab, state.direction, addTab, show, closeDialog]);

  return {
    conversionState: state,
    startSaveAsMarkdown,
    startSaveAsHtml,
    closeDialog,
    convertAndSave,
    convertAndOpenTab,
  };
}
