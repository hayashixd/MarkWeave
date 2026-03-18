//! ハートビート監視モジュール。
//!
//! フロントエンド（JS）が 10 秒ごとに `heartbeat` コマンドを呼ぶ。
//! 60 秒間ハートビートが届かない場合、アプリがフリーズしたと判断して
//! 強制終了する。フロントエンドの crash-recovery が 30 秒ごとに
//! チェックポイントを保存しているため、次回起動時に復元ダイアログが表示される。
//!
//! ## スリープ復帰の誤爆防止
//! PC スリープ中は Rust スレッドも JS も停止する。復帰後に
//! `now - last_beat` が大きくなり誤って強制終了するのを防ぐため、
//! ウォッチドッグループが「予定より大幅に遅く起きた」場合は
//! スリープ復帰とみなして `last_beat` をリセットする。

use std::sync::{
    atomic::{AtomicI64, Ordering},
    Arc,
};
use std::time::{SystemTime, UNIX_EPOCH};

/// フリーズ判定タイムアウト（秒）。
/// フロントエンドが 10 秒ごとに送るので、6 回連続で届かなければフリーズとみなす。
const HEARTBEAT_TIMEOUT_SECS: i64 = 60;

/// ウォッチドッグスレッドのチェック間隔（秒）。
const CHECK_INTERVAL_SECS: u64 = 5;

/// チェック間隔のこの倍数を超えて遅く起きた場合をスリープ復帰とみなす。
/// 5秒 × 3 = 15秒以上 sleep が続いたらシステムスリープと判定。
const SLEEP_DETECT_MULTIPLIER: i64 = 3;

/// ハートビート監視の状態。
/// `last_beat` が 0 のとき「まだ初回ハートビート待ち」を意味する。
pub struct WatchdogState {
    pub last_beat: Arc<AtomicI64>,
}

impl WatchdogState {
    pub fn new() -> Self {
        Self {
            last_beat: Arc::new(AtomicI64::new(0)),
        }
    }
}

/// フロントエンドから定期的に呼ばれるハートビートコマンド。
///
/// AppShell の useEffect で 10 秒ごとに invoke される。
#[tauri::command]
pub fn heartbeat(state: tauri::State<'_, WatchdogState>) {
    do_heartbeat(&state.last_beat);
}

/// ウォッチドッグスレッドを起動する。
///
/// `setup()` から呼ぶこと。`WatchdogState` の Arc を渡すことで、
/// Tauri の State ライフタイムとは独立してスレッドが参照できる。
pub fn start_watchdog(last_beat: Arc<AtomicI64>) {
    std::thread::Builder::new()
        .name("watchdog".to_string())
        .spawn(move || {
            let sleep_threshold = CHECK_INTERVAL_SECS as i64 * SLEEP_DETECT_MULTIPLIER;
            let mut last_woke_at = unix_now();

            loop {
                std::thread::sleep(std::time::Duration::from_secs(CHECK_INTERVAL_SECS));

                let now = unix_now();

                // スリープ復帰の検出:
                // 予定の CHECK_INTERVAL_SECS より大幅に遅く起きた場合は
                // システムスリープから復帰したとみなし、last_beat をリセットする。
                let woke_gap = now - last_woke_at;
                last_woke_at = now;
                if is_sleep_resume(woke_gap, sleep_threshold) {
                    log::info!(
                        "Watchdog: {}秒間停止を検出（システムスリープ復帰とみなす）。タイマーをリセットします。",
                        woke_gap
                    );
                    last_beat.store(now, Ordering::Relaxed);
                    continue;
                }

                let last = last_beat.load(Ordering::Relaxed);

                // 初回ハートビート未受信 → 起動中の可能性があるためスキップ
                if last == 0 {
                    continue;
                }

                let elapsed = now - last;

                if is_frozen(elapsed, HEARTBEAT_TIMEOUT_SECS) {
                    log::error!(
                        "Watchdog: {}秒間ハートビートなし。フリーズを検出したため強制終了します。",
                        elapsed
                    );
                    std::process::exit(1);
                }
            }
        })
        .expect("watchdog スレッドの起動に失敗しました");
}

// ─── 純粋関数（テスト可能） ────────────────────────────────────────────────

/// `last_beat` を現在時刻に更新する。
/// `heartbeat` コマンドから呼ばれる。テストからも直接呼べる。
pub(crate) fn do_heartbeat(last_beat: &AtomicI64) {
    last_beat.store(unix_now(), Ordering::Relaxed);
}

/// スリープ復帰かどうかを判定する。
/// `woke_gap`: 前回チェックからの実経過秒数。
/// `threshold`: この値を超えたらスリープ復帰とみなす。
pub(crate) fn is_sleep_resume(woke_gap: i64, threshold: i64) -> bool {
    woke_gap > threshold
}

/// フリーズかどうかを判定する。
/// `elapsed`: 最後のハートビートからの経過秒数。
/// `timeout`: この値を超えたらフリーズとみなす。
pub(crate) fn is_frozen(elapsed: i64, timeout: i64) -> bool {
    elapsed > timeout
}

pub(crate) fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

// ─── テスト ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::Ordering;

    // ── WatchdogState ────────────────────────────────────────────────────

    #[test]
    fn new_initializes_last_beat_to_zero() {
        let state = WatchdogState::new();
        assert_eq!(state.last_beat.load(Ordering::Relaxed), 0,
            "初回ハートビート待ちを示す sentinel 値 0 で初期化されること");
    }

    // ── do_heartbeat ─────────────────────────────────────────────────────

    #[test]
    fn do_heartbeat_updates_last_beat() {
        let atom = AtomicI64::new(0);
        let before = unix_now();
        do_heartbeat(&atom);
        let stored = atom.load(Ordering::Relaxed);
        assert!(stored >= before,
            "heartbeat 後の値は呼び出し前の unix_now 以上であること");
    }

    #[test]
    fn do_heartbeat_overwrites_old_value() {
        let atom = AtomicI64::new(1_000_000);
        do_heartbeat(&atom);
        let stored = atom.load(Ordering::Relaxed);
        // unix_now() は 2024 年以降なので 1_000_000（1970年1月12日相当）より必ず大きい
        assert!(stored > 1_000_000,
            "古いタイムスタンプを現在時刻で上書きすること");
    }

    // ── is_sleep_resume ──────────────────────────────────────────────────

    #[test]
    fn sleep_resume_detected_when_gap_exceeds_threshold() {
        assert!(is_sleep_resume(16, 15), "閾値超過はスリープ復帰と判定すること");
    }

    #[test]
    fn sleep_resume_not_detected_at_exact_threshold() {
        assert!(!is_sleep_resume(15, 15), "閾値ちょうどはスリープ復帰と判定しないこと");
    }

    #[test]
    fn sleep_resume_not_detected_below_threshold() {
        assert!(!is_sleep_resume(5, 15), "閾値未満は通常のチェックとして扱うこと");
    }

    #[test]
    fn sleep_resume_not_detected_for_zero_gap() {
        assert!(!is_sleep_resume(0, 15), "gap=0 はスリープ復帰と判定しないこと");
    }

    // ── is_frozen ────────────────────────────────────────────────────────

    #[test]
    fn frozen_detected_when_elapsed_exceeds_timeout() {
        assert!(is_frozen(61, 60), "タイムアウト超過はフリーズと判定すること");
    }

    #[test]
    fn frozen_not_detected_at_exact_timeout() {
        assert!(!is_frozen(60, 60), "タイムアウトちょうどはフリーズと判定しないこと");
    }

    #[test]
    fn frozen_not_detected_below_timeout() {
        assert!(!is_frozen(30, 60), "タイムアウト未満は正常と判定すること");
    }

    #[test]
    fn frozen_not_detected_for_zero_elapsed() {
        assert!(!is_frozen(0, 60), "elapsed=0 はフリーズと判定しないこと");
    }

    // ── 定数の整合性 ─────────────────────────────────────────────────────

    #[test]
    fn timeout_is_multiple_of_heartbeat_interval() {
        // ハートビート間隔 10 秒の倍数であること（切りのいい回数で検出できる）
        let heartbeat_interval = 10i64;
        assert_eq!(HEARTBEAT_TIMEOUT_SECS % heartbeat_interval, 0,
            "タイムアウトはハートビート間隔の倍数であること");
    }

    #[test]
    fn sleep_threshold_is_less_than_timeout() {
        let sleep_threshold = CHECK_INTERVAL_SECS as i64 * SLEEP_DETECT_MULTIPLIER;
        assert!(sleep_threshold < HEARTBEAT_TIMEOUT_SECS,
            "スリープ検出閾値はフリーズタイムアウトより小さいこと（スリープをフリーズと誤判定しないため）");
    }

    #[test]
    fn check_interval_is_shorter_than_heartbeat_interval() {
        let heartbeat_interval = 10u64;
        assert!(CHECK_INTERVAL_SECS < heartbeat_interval,
            "チェック間隔はハートビート間隔より短いこと（フリーズを素早く検出するため）");
    }
}
