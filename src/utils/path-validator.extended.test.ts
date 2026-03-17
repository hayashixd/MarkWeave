/**
 * path-validator 追加テスト — URL エンコード / Unicode / 極端な入力
 *
 * containsTraversalPattern は生の文字列を検査するため、URL エンコードされた
 * トラバーサルは「検出できない」ことも意図的な動作として文書化する。
 * 最終的なパス制限は Tauri plugin-fs のスコープ検証が担う（多層防御設計）。
 */

import { describe, it, expect } from 'vitest';
import { containsTraversalPattern } from './path-validator';

describe('path-validator – extended edge cases', () => {
  // ---------------------------------------------------------------------------
  // URL エンコードされたトラバーサル（生文字列検査の限界を文書化）
  // ---------------------------------------------------------------------------
  describe('URL-encoded traversal (documents raw-string check limits)', () => {
    it('%2e%2e%2f は containsTraversalPattern に検出されない（Tauri 側でブロック）', () => {
      // URL デコード前の生文字列には ../ が存在しないため false が正しい動作
      expect(containsTraversalPattern('%2e%2e%2f')).toBe(false);
    });

    it('%2e%2e/ は containsTraversalPattern に検出されない', () => {
      expect(containsTraversalPattern('%2e%2e/')).toBe(false);
    });

    it('..%2F は containsTraversalPattern に検出されない（/ がエンコード済み）', () => {
      expect(containsTraversalPattern('..%2F')).toBe(false);
    });

    it('%252e%252e%252f（二重エンコード）は検出されない', () => {
      expect(containsTraversalPattern('%252e%252e%252f')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Unicode 類似文字（全角ピリオド等）
  // ---------------------------------------------------------------------------
  describe('Unicode lookalike characters (documents limits)', () => {
    it('全角ピリオド ．．/ (U+FF0E) は検出されない（OS が展開しない）', () => {
      // U+FF0E FULLWIDTH FULL STOP は U+002E FULL STOP とは別コードポイント
      expect(containsTraversalPattern('．．/')).toBe(false);
    });

    it('通常の ASCII ドットと全角ドットの混在は検出されない', () => {
      expect(containsTraversalPattern('.．/')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 極端な入力
  // ---------------------------------------------------------------------------
  describe('extreme path lengths', () => {
    it('10,000 文字セグメントを含むパスをクラッシュなく処理できる', () => {
      const longSegment = 'a'.repeat(10_000);
      const longPath = `/home/user/${longSegment}/file.md`;
      expect(() => containsTraversalPattern(longPath)).not.toThrow();
      expect(containsTraversalPattern(longPath)).toBe(false);
    });

    it('1MB のパス文字列をクラッシュなく処理できる', () => {
      const hugePath = 'a'.repeat(1024 * 1024);
      expect(() => containsTraversalPattern(hugePath)).not.toThrow();
    });

    it('スラッシュのみの文字列は安全と判断される', () => {
      expect(containsTraversalPattern('/')).toBe(false);
    });

    it('空白のみの文字列は安全と判断される', () => {
      expect(containsTraversalPattern('   ')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 追加のトラバーサルパターン
  // ---------------------------------------------------------------------------
  describe('additional traversal detection', () => {
    it('.. 単体を検出する', () => {
      expect(containsTraversalPattern('..')).toBe(true);
    });

    it('複数の ..\\..\\（Windows バックスラッシュ）を検出する', () => {
      expect(containsTraversalPattern('..\\..\\windows')).toBe(true);
    });

    it('/home/../etc のような中間トラバーサルを検出する', () => {
      expect(containsTraversalPattern('/home/../etc')).toBe(true);
    });

    it('ドライブレター直後のトラバーサルを検出する（Windows）', () => {
      expect(containsTraversalPattern('C:\\..\\Windows\\System32')).toBe(true);
    });

    it('C:\\Users\\user\\docs\\file.md は安全', () => {
      expect(containsTraversalPattern('C:\\Users\\user\\docs\\file.md')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 正常パスが誤検知されないこと
  // ---------------------------------------------------------------------------
  describe('valid paths are not flagged', () => {
    it('.git ディレクトリを含むパスは安全', () => {
      expect(containsTraversalPattern('/home/user/project/.git/config')).toBe(false);
    });

    it('ドットで始まる隠しファイルは安全', () => {
      expect(containsTraversalPattern('/home/user/.hidden-file.md')).toBe(false);
    });

    it('深くネストされた通常パスは安全', () => {
      expect(containsTraversalPattern('/a/b/c/d/e/f/g/h.md')).toBe(false);
    });

    it('拡張子に複数のドットを含むファイル名は安全', () => {
      expect(containsTraversalPattern('/workspace/archive.tar.gz')).toBe(false);
    });

    it('パス内の単一ドット（./）は安全', () => {
      expect(containsTraversalPattern('/home/user/./file.md')).toBe(false);
    });
  });
});
