/**
 * 自然言語検出モジュール
 *
 * ai-design.md §9 に準拠。
 *
 * Unicode スクリプト分析による優先判定 + franc ライブラリによるフォールバック。
 * CJK（中国語・日本語・韓国語）の区別精度を改善する。
 */

import { franc } from 'franc';

/**
 * テキストの自然言語を検出する（ISO 639-1 コード）。
 *
 * 判定優先順位:
 * 1. ひらがな・カタカナ → 日本語 (ja)
 * 2. ハングル → 韓国語 (ko)
 * 3. 漢字比率 > 50% → franc で中国語/日本語を区別
 * 4. franc フォールバック
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length < 3) return 'en';

  // 1. ひらがな・カタカナが含まれていれば日本語確定
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return 'ja';
  }

  // 2. ハングルが含まれていれば韓国語確定
  if (/[\uAC00-\uD7A3\u1100-\u11FF]/.test(text)) {
    return 'ko';
  }

  // 3. 漢字のみの場合は franc で中国語/日本語を判定
  const cjkCount = (text.match(/[\u4E00-\u9FFF]/g) ?? []).length;
  const totalCount = text.replace(/\s/g, '').length;
  if (totalCount > 0 && cjkCount / totalCount > 0.5) {
    const detected = franc(text, { minLength: 10 });
    return detected === 'cmn' || detected === 'yue' ? 'zh' : 'ja';
  }

  // 4. franc フォールバック
  const iso3 = franc(text, { minLength: 10 });
  return iso3ToIso1(iso3) ?? 'en';
}

/** ISO 639-3 → ISO 639-1 変換マップ */
function iso3ToIso1(iso3: string): string | null {
  const map: Record<string, string> = {
    eng: 'en',
    jpn: 'ja',
    zho: 'zh',
    cmn: 'zh',
    yue: 'zh',
    kor: 'ko',
    deu: 'de',
    fra: 'fr',
    spa: 'es',
    por: 'pt',
    ita: 'it',
    nld: 'nl',
    rus: 'ru',
    ara: 'ar',
    hin: 'hi',
    tha: 'th',
    vie: 'vi',
    ind: 'id',
    msa: 'ms',
    tur: 'tr',
    pol: 'pl',
    ukr: 'uk',
    swe: 'sv',
    dan: 'da',
    nor: 'no',
    fin: 'fi',
  };
  return map[iso3] ?? null;
}
