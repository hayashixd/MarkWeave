/**
 * 執筆スタイル設定タブ
 *
 * ペルソナ対応:
 * - 知識管理者・一般ライター: フォーカスモード / タイプライターモード / Zen Mode の設定
 *
 * Phase 7 ロードマップ: フォーカスモード・タイプライターモード・Zen モード
 */

import { useSettingsStore } from '../../../store/settingsStore';
import type { AmbientSoundType } from '../../../lib/ambient-sound';

const AMBIENT_OPTIONS: { type: AmbientSoundType; label: string; description: string }[] = [
  { type: 'off',   label: '停止',          description: '環境音なし' },
  { type: 'white', label: 'ホワイトノイズ',  description: '全周波数均一のノイズ。集中作業向き' },
  { type: 'brown', label: 'ブラウンノイズ',  description: '低域が強い穏やかなノイズ。読書・思考向き' },
  { type: 'rain',  label: '雨音',          description: '雨が降る環境音。リラックス向き' },
  { type: 'cafe',  label: 'カフェ',         description: 'カフェのざわめき。創作向き' },
];

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  shortcut,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  shortcut?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          {shortcut && (
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-xs">
              {shortcut}
            </kbd>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0 mt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={[
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            checked ? 'bg-blue-500' : 'bg-gray-300',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
            ].join(' ')}
          />
        </button>
      </div>
    </label>
  );
}

export function WritingTab() {
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">集中・執筆モード</h2>
      <div className="bg-gray-50 rounded-lg px-4 mb-6">
        <ToggleRow
          label="フォーカスモード"
          description="カーソルのあるブロック以外を薄く表示し、今書いている箇所に集中できます。"
          checked={settings.editor.focusMode}
          onChange={(v) => updateSettings({ editor: { focusMode: v } })}
          shortcut="Ctrl+Shift+F"
        />
        <ToggleRow
          label="タイプライターモード"
          description="カーソル行を常に画面の中央に保ちます。長文執筆で首や目の疲れを軽減します。"
          checked={settings.editor.typewriterMode}
          onChange={(v) => updateSettings({ editor: { typewriterMode: v } })}
          shortcut="Ctrl+Shift+T"
        />
        <ToggleRow
          label="Zen モード"
          description="タブバー・サイドバー・ステータスバーを非表示にして執筆に没頭できます。F11 でトグルできます。"
          checked={settings.editor.zenMode}
          onChange={(v) => updateSettings({ editor: { zenMode: v } })}
          shortcut="F11"
        />
      </div>

      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">執筆目標</h2>
      <div className="bg-gray-50 rounded-lg px-4 py-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-800">目標文字数</div>
            <div className="text-xs text-gray-500 mt-0.5">
              設定するとステータスバーに進捗バーが表示されます。0 = 無効
            </div>
          </div>
          <input
            type="number"
            min={0}
            max={100000}
            step={100}
            value={settings.editor.writingGoal}
            onChange={(e) => updateSettings({ editor: { writingGoal: Math.max(0, parseInt(e.target.value) || 0) } })}
            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
          />
        </div>
        {settings.editor.writingGoal > 0 && (
          <p className="text-xs text-blue-600 mt-2">
            ステータスバーに「現在の文字数 / {settings.editor.writingGoal.toLocaleString()}文字」が表示されます
          </p>
        )}
      </div>

      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">ポモドーロタイマー</h2>
      <div className="bg-gray-50 rounded-lg px-4 mb-6">
        <ToggleRow
          label="ポモドーロタイマー"
          description="ステータスバーに25分集中→5分休憩のカウントダウンタイマーを表示します。"
          checked={settings.editor.pomodoroEnabled}
          onChange={(v) => updateSettings({ editor: { pomodoroEnabled: v } })}
        />
        {settings.editor.pomodoroEnabled && (
          <div className="pb-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">集中時間（分）</div>
              </div>
              <input
                type="number"
                min={1}
                max={120}
                value={settings.editor.pomodoroWorkMinutes}
                onChange={(e) => updateSettings({ editor: { pomodoroWorkMinutes: Math.max(1, parseInt(e.target.value) || 25) } })}
                className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">休憩時間（分）</div>
              </div>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.editor.pomodoroBreakMinutes}
                onChange={(e) => updateSettings({ editor: { pomodoroBreakMinutes: Math.max(1, parseInt(e.target.value) || 5) } })}
                className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
              />
            </div>
          </div>
        )}
      </div>

      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">ワードスプリント</h2>
      <div className="bg-gray-50 rounded-lg px-4 mb-6">
        <ToggleRow
          label="ワードスプリント"
          description="制限時間内に目標文字数の達成を目指すスプリントモード。ステータスバーから開始できます。"
          checked={settings.editor.wordSprintEnabled}
          onChange={(v) => updateSettings({ editor: { wordSprintEnabled: v } })}
        />
        {settings.editor.wordSprintEnabled && (
          <div className="pb-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">制限時間（分）</div>
              </div>
              <input
                type="number"
                min={1}
                max={120}
                value={settings.editor.wordSprintDurationMinutes}
                onChange={(e) => updateSettings({ editor: { wordSprintDurationMinutes: Math.max(1, parseInt(e.target.value) || 15) } })}
                className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">目標文字数</div>
              </div>
              <input
                type="number"
                min={10}
                max={100000}
                step={100}
                value={settings.editor.wordSprintTargetWords}
                onChange={(e) => updateSettings({ editor: { wordSprintTargetWords: Math.max(10, parseInt(e.target.value) || 500) } })}
                className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-right"
              />
            </div>
          </div>
        )}
      </div>

      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">環境音</h2>
      <div className="bg-gray-50 rounded-lg px-4 py-3 mb-6">
        <p className="text-xs text-gray-500 mb-3">集中執筆のための背景音。ツールバーからも切り替え可能です。</p>
        <div className="space-y-1">
          {AMBIENT_OPTIONS.map((opt) => (
            <label key={opt.type} className="flex items-start gap-3 cursor-pointer py-1.5">
              <input
                type="radio"
                name="ambientSound"
                value={opt.type}
                checked={settings.editor.ambientSound === opt.type}
                onChange={() => updateSettings({ editor: { ambientSound: opt.type } })}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                <p className="text-xs text-gray-400">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
        {settings.editor.ambientSound !== 'off' && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">音量</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.editor.ambientVolume}
              onChange={(e) => updateSettings({ editor: { ambientVolume: parseFloat(e.target.value) } })}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 w-8">{Math.round(settings.editor.ambientVolume * 100)}%</span>
          </div>
        )}
      </div>

      {/* タイプライター打鍵音 */}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-6">タイプライター打鍵音</h2>
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.editor.typewriterSound}
            onChange={(e) => updateSettings({ editor: { typewriterSound: e.target.checked } })}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700">打鍵音を有効にする</span>
        </label>
        {settings.editor.typewriterSound && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">サウンドスタイル</span>
              {([
                { value: 'mechanical', label: 'メカニカル', desc: 'コクッとした明確なクリック音' },
                { value: 'soft', label: 'ソフト', desc: '柔らかな押し下げ音' },
                { value: 'typewriter', label: 'タイプライター', desc: 'ヴィンテージ打鍵音' },
              ] as const).map((opt) => (
                <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="typewriterStyle"
                    value={opt.value}
                    checked={settings.editor.typewriterStyle === opt.value}
                    onChange={() => updateSettings({ editor: { typewriterStyle: opt.value } })}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm text-gray-700">{opt.label}</span>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">音量</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.editor.typewriterVolume}
                onChange={(e) => updateSettings({ editor: { typewriterVolume: parseFloat(e.target.value) } })}
                className="flex-1"
              />
              <span className="text-xs text-gray-500 w-8">{Math.round(settings.editor.typewriterVolume * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-6">ヒント</h2>
      <div className="text-xs text-gray-500 space-y-1.5 bg-blue-50 rounded-lg px-4 py-3">
        <p>・フォーカスモード + タイプライターモードを同時に使うと最大限集中できます</p>
        <p>・Zen モード中は Escape キーで通常表示に戻れます</p>
        <p>・ツールバーの集中ボタン群でもこれらの設定をトグルできます</p>
      </div>
    </div>
  );
}
