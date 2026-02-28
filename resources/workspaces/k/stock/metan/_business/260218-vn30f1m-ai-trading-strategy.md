---
name: "VN30F1M AI Trading Strategy"
description: "Updated business and technical approach for VN30F1M AI: Triple Barrier labeling, LightGBM-first (HOLD/LONG/SHORT), multi-angle feature engineering, walk-forward validation with Go/No-Go gates. Supersedes 251229 model plan."
tags: [vn30, ai, trading, lightgbm, triple-barrier, feature-engineering, backtesting]
category: business
status: planning
updated: 2026-02-18
---

# VN30F1M AI Trading Strategy — Business & Technical Approach

> **Status:** 📋 PLANNING
> **Date:** 2026-02-18
> **Supersedes:** `resources/workspaces/k/stock/metan/_business/251229-vn30f1m-intraday-trading-ai.md` (model selection & implementation plan sections)

## 1. Business Objective

Xây dựng AI system dự đoán hành động giao dịch intraday cho hợp đồng phái sinh VN30F1M.

**Output:** Tại mỗi candle 5 phút, AI đưa ra 1 trong 3 quyết định:

| Action | Ý nghĩa | Exit condition |
|---|---|---|
| **LONG** | Vào vị thế mua, kỳ vọng giá tăng | Chạm take-profit, chạm stop-loss, hoặc cuối phiên |
| **SHORT** | Vào vị thế bán, kỳ vọng giá giảm | Chạm take-profit, chạm stop-loss, hoặc cuối phiên |
| **HOLD** | Không vào vị thế | — |

**Ràng buộc:**

- Chỉ nắm giữ trong phiên (intraday only, không qua đêm)
- Bắt buộc đóng lệnh khi: chạm target profit, chạm stop loss, hoặc hết phiên (14:30 VN time)

## 2. Data Foundation

### 2.1 Data hiện có

| Data | Source | Volume | Status |
|---|---|---|---|
| VN30 Index OHLCV (5-min candles) | Tick data → `TickVN30IndexCalculator` | ~500 ngày × 60 candles/ngày ≈ 30,000 samples | ✅ Done |
| Whale footprint features (30 stocks → aggregated VN30) | `VN30FeaturePipeline` | Same | ✅ Done |
| Component stock features (30 symbols) | `IntradaySymbolFeaturePersistor` | 30 × 30,000 | ✅ Done |

### 2.2 Features hiện có (VN30 level)

**Price Action:**

- `open`, `high`, `low`, `close` — VN30 index OHLCV
- `volume`, `value` — Tổng volume/value của 30 stocks

**Whale Footprint (per threshold 450, 900):**

| Category | Features | Ý nghĩa |
|---|---|---|
| Value | `vn30_shark{450,900}_{buy,sell}_value` | Giá trị mua/bán (triệu VND) của cá mập trong candle |
| Value | `vn30_sheep{450,900}_{buy,sell}_value` | Giá trị mua/bán của sheep trong candle |
| Ratio 5D | `vn30_shark{450,900}_{buy,sell}_ratio_5d_pc` | Tỷ lệ so với baseline 5 ngày |
| Percent | `vn30_percent_shark{450,900}_buy_sell` | % mua trong tổng flow cá mập |
| Percent | `vn30_percent_sheep{450,900}_buy_sell` | % mua trong tổng flow sheep |
| Percent | `vn30_percent_buy_shark{450,900}_sheep` | % shark trong tổng lực mua |
| Percent | `vn30_percent_sell_shark{450,900}_sheep` | % shark trong tổng lực bán |
| Accum % | `vn30_accum_percent_shark{450,900}_buy_sell` | Lũy kế % shark buy/sell từ đầu phiên |
| Accum % | `vn30_accum_percent_sheep{450,900}_buy_sell` | Lũy kế % sheep buy/sell từ đầu phiên |
| Accum % | `vn30_accum_percent_buy_shark{450,900}_sheep` | Lũy kế % shark trong tổng buy |
| Accum % | `vn30_accum_percent_sell_shark{450,900}_sheep` | Lũy kế % shark trong tổng sell |
| Urgency | `vn30_shark{450,900}_urgency_spread` | Chênh lệch VWAP buy/sell (market cap weighted) |

### 2.3 Nhận định về features hiện có

Features hiện tại tập trung vào **một góc nhìn duy nhất: dòng tiền lớn (whale footprint)**. Đây là góc nhìn có giá trị nhưng chưa đủ để model prediction. Cần bổ sung thêm features từ các góc nhìn khác (xem Section 5).

## 3. Phương Pháp: Triple Barrier Labeling

### 3.1 Tại sao không dùng next-candle return?

Cách thông thường (dự đoán return candle tiếp theo) không phản ánh trading thực tế:

```
❌ Traditional: predict y = (next_close - current_close) / current_close
   → Vấn đề: Ai cũng hold > 1 candle. Noise cực cao ở 5-min.
   → Model phải convert prediction → action qua threshold → thêm 1 lớp approximation

✅ Triple Barrier: predict y = kết quả THỰC TẾ nếu vào lệnh tại candle này
   → Model trực tiếp output: action này có profitable không?
   → Match 100% với cách thực sự trade
```

### 3.2 Cách hoạt động

Với mỗi candle trong training data, nhìn forward và gán label dựa trên 3 "barrier":

```
Price
  ↑
  │  ═══════════════════════ Take Profit barrier (+TP%)
  │
  │         ╱╲    ╱╲
  │    ╱╲  ╱  ╲  ╱  ╲ ╱╲
  │───╱──╲╱────╲╱────╳──╲──────── Entry price
  │  ╱                    ╲
  │ ╱
  │  ═══════════════════════ Stop Loss barrier (-SL%)
  │
  │─────────────────────────────── Session End barrier (14:30)
  └──────────────────────────────── Time →
```

**Label cho LONG signal:**

| Scenario | Condition | Label |
|---|---|---|
| TP hit trước SL | Giá chạm +TP% trước khi chạm -SL% | **+1** (LONG đúng) |
| SL hit trước TP | Giá chạm -SL% trước khi chạm +TP% | **-1** (LONG sai) |
| Session end | Hết phiên, không chạm TP cũng không chạm SL | **0** (neutral) |

**Tương tự cho SHORT signal** (đảo ngược TP và SL).

### 3.3 Tham số Triple Barrier

| Parameter | Giá trị khởi đầu | Ghi chú |
|---|---|---|
| Take Profit (TP) | 0.5% | Tune trên validation set |
| Stop Loss (SL) | 0.3% | Tune trên validation set |
| Max holding time | Đến cuối phiên (14:30 VN) | Hard constraint |
| Min candles remaining | 6 (30 phút trước đóng cửa) | Không vào lệnh quá gần cuối phiên |

### 3.4 Ưu điểm

- **Match trading thực tế**: Label phản ánh chính xác kết quả nếu thực sự vào lệnh
- **Giảm noise**: Không phụ thuộc vào 1 candle duy nhất, mà nhìn toàn bộ horizon
- **Classification tự nhiên**: Output trực tiếp là 3 classes (LONG / SHORT / HOLD), không cần threshold tuning
- **Backtesting consistency**: Labels chính là trading decisions, backtest chỉ cần replay

## 4. AI Model Approach

### 4.1 Tại sao chọn LightGBM làm model chính

| Yếu tố | LightGBM | LSTM | Ensemble (LightGBM + LSTM) |
|---|---|---|---|
| Data requirement | ~10K samples (đủ) | ~50K+ (thiếu) | ~30K+ (borderline) |
| Feature type | Tabular/structured (match features hiện tại) | Sequence/raw (cần preprocess) | Cả hai |
| Train time | Phút | Giờ | Giờ |
| Iteration speed | Nhanh (thử 50+ experiments/ngày) | Chậm (2-3 experiments/ngày) | Rất chậm |
| Interpretability | Feature importance rõ ràng | Black box | Phần nào |
| Overfit risk (30K samples) | Thấp | Cao | Trung bình |

**Quyết định:** LightGBM là model duy nhất cho Phase đầu. LSTM và Ensemble chỉ xem xét nếu LightGBM cho kết quả khả quan và cần cải thiện thêm.

**Lý do không cần LSTM ngay:**

- Features hiện tại đã bao gồm accumulated values (`accum_*`) — encode temporal information
- LightGBM với lag features capture ~80-90% temporal patterns
- 30K samples không đủ cho LSTM thực sự outperform LightGBM

### 4.2 Problem Framing: Multiclass Classification

**Input:** Feature vector tại candle hiện tại (bao gồm lag features, rolling stats)

**Output:** 3 classes

| Class | Ý nghĩa | Model interpretation |
|---|---|---|
| **LONG (+1)** | Nên vào lệnh mua | "Nếu mua bây giờ, xác suất chạm TP cao" |
| **SHORT (-1)** | Nên vào lệnh bán | "Nếu bán bây giờ, xác suất chạm TP cao" |
| **HOLD (0)** | Không vào lệnh | "Không có edge rõ ràng" |

LightGBM output probability cho mỗi class. Chỉ trade khi probability > confidence threshold (tune trên validation set).

### 4.3 Vòng đời khi đưa vào thực tế

```
Mỗi 5 phút (khi candle mới đóng):
┌─────────────┐     ┌────────────────┐     ┌──────────────┐
│ VN30Feature │────→│ Feature        │────→│ LightGBM     │
│ Pipeline    │     │ Engineering    │     │ Predict      │
│ (raw data)  │     │ (lag, rolling) │     │ (3 classes)  │
└─────────────┘     └────────────────┘     └──────┬───────┘
                                                   │
                              ┌─────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │ confidence > TH? │
                    └───────┬──────────┘
                    YES     │     NO
                    ┌───────┴───────┐
                    ▼               ▼
            ┌──────────────┐  ┌──────────┐
            │ Execute      │  │ HOLD     │
            │ LONG / SHORT │  │ (no action)
            └──────────────┘  └──────────┘
```

## 5. Feature Engineering Plan

### 5.1 Chiến lược: Multi-Angle Features

Features hiện tại chỉ cover 1 góc nhìn (whale footprint). Cần mở rộng:

```
                    ┌──────────────────────────┐
                    │  AI MODEL (LightGBM)     │
                    │  Input: Multi-angle view │
                    └──────────┬───────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │ Whale Flow   │   │ Price Action │   │ Context      │
   │ (CÓ SẴN)    │   │ (CẦN THÊM)  │   │ (CẦN THÊM)  │
   ├──────────────┤   ├──────────────┤   ├──────────────┤
   │ shark values │   │ momentum     │   │ time of day  │
   │ ratios       │   │ volatility   │   │ session half │
   │ urgency      │   │ RSI          │   │ day of week  │
   │ percent      │   │ price vs open│   │ volume ratio │
   └──────────────┘   └──────────────┘   └──────────────┘
```

### 5.2 Features cần bổ sung

**Tier 1 — Derive từ data hiện có (ưu tiên cao, không cần data source mới)**

| Feature | Source | Ý nghĩa | Cách tính |
|---|---|---|---|
| `net_shark{450,900}_flow` | Existing whale features | Dòng tiền ròng shark | `buy_value - sell_value` |
| `shark_buy_sell_imbalance` | Existing | Mất cân bằng dòng tiền | `(buy - sell) / (buy + sell)` |
| `return_N` (N = 1, 3, 6, 12) | Close price | Momentum ngắn hạn | `(close - close_N_ago) / close_N_ago` |
| `volatility_N` (N = 6, 12, 24) | Close price | Biến động gần đây | Rolling std of returns |
| `rsi_14` | Close price | Overbought / oversold | Standard RSI calculation |
| `close_vs_day_open` | Close + day's first candle | Vị trí giá so với mở cửa | `(close - day_open) / day_open` |
| `high_vs_low_range` | High, Low | Biên độ trong candle | `(high - low) / close` |
| `volume_ratio` | Volume | Volume đột biến? | `volume / rolling_mean_volume_20` |
| `candle_of_session` | Time field | Vị trí trong phiên (0-59) | Index of candle in trading day |
| `is_morning` | Time field | Sáng hay chiều | Boolean (trước/sau lunch break) |
| `day_of_week` | Date field | Thứ trong tuần | 0-4 (Mon-Fri) |

**Tier 2 — Cần data source bổ sung (xem xét sau Phase 1)**

| Feature | Data cần | Giá trị |
|---|---|---|
| VN30F1M basis (premium/discount vs VN30 spot) | Giá VN30F1M realtime | Signal trực tiếp nhất về sentiment phái sinh |
| Open Interest change | VN30F1M OI data | Vị thế mới mở hay đóng |

### 5.3 Lag Features cho LightGBM

LightGBM xử lý mỗi sample độc lập, nên cần tạo lag features để model "nhìn thấy" quá khứ:

```
Với mỗi feature quan trọng (close, volume, net_shark_flow, ...):
  - Lag 1, 2, 3, 6, 12 candle  (5 min → 1 hour lookback)
  - Rolling mean 6, 12 candle
  - Rolling std 6, 12 candle
  - Change vs lag 1, 3, 6
```

Lưu ý: Lag features KHÔNG áp dụng cross-day (candle cuối ngày hôm trước → candle đầu ngày hôm nay). Mỗi ngày giao dịch là independent.

## 6. Evaluation Framework

### 6.1 Data Split Strategy

```
500 ngày data (~30,000 candles)

Option A: Simple Split
├── Train:      Ngày 1-350 (~21,000 samples)
├── Validation: Ngày 351-425 (~4,500 samples)
└── Test:       Ngày 426-500 (~4,500 samples)

Option B: Walk-Forward (ưu tiên — robust hơn)
├── Window 1: Train ngày 1-300,  Test ngày 301-330
├── Window 2: Train ngày 30-330, Test ngày 331-360
├── Window 3: Train ngày 60-360, Test ngày 361-390
├── ...
└── Đánh giá: bao nhiêu % windows profitable?
```

**Nguyên tắc bắt buộc:**

- Split theo thời gian (không bao giờ random shuffle — gây data leakage)
- Validation dùng để tune hyperparameters + confidence threshold
- Test set chỉ dùng 1 lần cuối cùng

### 6.2 Success Criteria (Realistic)

| Metric | Minimum Viable | Good | Measurement |
|---|---|---|---|
| **Directional Accuracy** | > 51% | > 53% | % quyết định LONG/SHORT đúng hướng |
| **Profit Factor** | > 1.1 | > 1.3 | Tổng lãi / Tổng lỗ |
| **Win Rate** | > 48% | > 52% | % trades có lãi (sau transaction costs) |
| **Sharpe Ratio** | > 0.5 | > 1.0 | Risk-adjusted return (annualized) |
| **Max Drawdown** | < 15% | < 10% | Mức sụt giảm tối đa từ đỉnh |
| **Walk-forward Consistency** | > 55% windows profitable | > 65% | % windows có cumulative profit > 0 |
| **Avg Trades/Day** | 3-20 | 5-15 | Không quá ít (miss opportunity) hoặc quá nhiều (overtrading) |

**Tại sao thresholds thấp hơn document trước?**

Financial markets cực kỳ noisy ở timeframe 5 phút. Directional accuracy 51% nghe có vẻ thấp nhưng nếu duy trì ổn định và kết hợp risk management phù hợp (TP > SL), vẫn tạo ra profit. Nhiều quant fund chuyên nghiệp hoạt động ở mức win rate 48-52% nhưng profitable nhờ profit factor > 1.

### 6.3 Go/No-Go Gates

| Gate | Condition | Action nếu FAIL |
|---|---|---|
| **Gate 1** (sau EDA) | Ít nhất 3 features có statistical significance với labels | STOP — features không đủ signal. Cần nghiên cứu thêm features mới |
| **Gate 2** (sau LightGBM baseline) | Directional accuracy > 50.5% trên test set | STOP — không beat random. Focus thêm features hoặc khác target variable |
| **Gate 3** (sau walk-forward) | > 50% windows profitable | STOP — model không stable. Investigate regime sensitivity |
| **Gate 4** (sau realistic backtest) | Net positive PnL sau transaction costs | Proceed to production pilot |

## 7. Execution Phases

### Phase 1: EDA + Feature Validation (3-4 ngày)

**Mục tiêu:** Biết features có signal không. Fail fast nếu không.

**Approach:**

1. Export 500 ngày VN30 features từ DB
2. Build triple barrier labels (TP=0.5%, SL=0.3%)
3. Statistical analysis (dùng toàn bộ 500 ngày, không cần split):
   - Chia mỗi feature thành quartiles, so sánh label distribution giữa các nhóm
   - Mutual information score giữa features và labels
   - Visualization: tỷ lệ LONG labels khi shark buy value ở top 25% vs bottom 25%
4. Quick LightGBM (default params, train 200 ngày ~12K samples, test 50 ngày ~3K samples). Nếu signal đủ mạnh, nó sẽ xuất hiện ngay cả với ít data — nếu cần 400 ngày mới beat random thì signal quá yếu để trade thực tế.
5. Feature importance ranking

**Go/No-Go:** Gate 1 + Gate 2

### Phase 2: Feature Engineering (3-4 ngày)

**Mục tiêu:** Bổ sung features từ Section 5.2 Tier 1

**Approach:**

1. Implement Tier 1 features (derive từ data hiện có)
2. Build lag features + rolling statistics
3. Re-run LightGBM → so sánh với Phase 1 baseline
4. Feature importance → loại features không đóng góp
5. Iterative: thử các feature combinations

### Phase 3: Model Training + Tuning (4-5 ngày)

**Mục tiêu:** Best LightGBM model với optimized hyperparameters

**Approach:**

1. Hyperparameter optimization (Optuna, 100+ trials)
2. Feature selection (loại bỏ features redundant/noise)
3. Confidence threshold tuning trên validation set
4. Triple barrier parameter sensitivity (thử TP/SL khác nhau)

### Phase 4: Walk-Forward Validation + Backtest (3-4 ngày)

**Mục tiêu:** Validate model robust across different time periods

**Approach:**

1. Walk-forward validation (rolling windows)
2. Realistic backtest:
   - Transaction costs: ~0.03% mỗi lệnh (round-trip)
   - Slippage: ~0.02% (VN30F1M có liquidity vừa phải)
   - Position sizing: fixed 1 contract
3. Metrics dashboard
4. Analyze losing periods: tại sao model sai? Market regime change?

**Go/No-Go:** Gate 3 + Gate 4

### Phase 5: Scale Up (chỉ nếu Phase 4 positive)

Xem xét (theo thứ tự ưu tiên):

1. **LSTM exploration** — thử xem có cải thiện so với LightGBM không
2. **Ensemble** — nếu LSTM cho uncorrelated predictions
3. **Contextual Bandits** — simplified RL, trực tiếp optimize trading reward
4. **Thêm Tier 2 features** — VN30F1M basis, open interest

## 8. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Features không có predictive power | Trung bình | Cao | Gate 1-2 fail fast. Không đầu tư model phức tạp nếu features yếu |
| Overfitting | Cao | Cao | Walk-forward validation, regularization, feature selection |
| Market regime change | Cao | Cao | Walk-forward detect instability. Periodic retraining |
| Data leakage | Thấp | Rất cao | Strict time-based splits. Lag features chỉ dùng past data |
| Transaction costs ăn hết profit | Trung bình | Cao | Realistic backtest bao gồm costs. Tối ưu trade frequency |
| Model degradation theo thời gian | Cao | Trung bình | Monitoring dashboard. Retrain schedule (monthly hoặc khi metrics giảm) |

## 9. Timeline Summary

| Phase | Duration | Go/No-Go Gate | Output |
|---|---|---|---|
| **1** EDA + Validation | 3-4 ngày | Gate 1-2 | Biết features có signal không |
| **2** Feature Engineering | 3-4 ngày | — | Enhanced feature set |
| **3** Model Training | 4-5 ngày | — | Best LightGBM model |
| **4** Walk-Forward + Backtest | 3-4 ngày | Gate 3-4 | Realistic performance report |
| **5** Scale Up (optional) | 5-7 ngày | — | LSTM/Ensemble nếu cần |
| | **Total (Phase 1-4)** | | **13-17 ngày (~3 tuần)** |

**So với plan trước (4-5 tuần):** Giảm ~2 tuần nhờ focus LightGBM first và bỏ LSTM/Ensemble ra khỏi critical path. Quan trọng hơn: biết kết quả sớm hơn nhờ Go/No-Go gates.

## 10. Open Questions

1. **VN30F1M data:** Có thể lấy giá VN30F1M realtime không? Nếu có, basis feature sẽ rất có giá trị (Tier 2)
2. **TP/SL values:** 0.5% TP và 0.3% SL là starting point. Cần validate trên data thực tế xem trade frequency và PnL distribution
3. **Retraining frequency:** Monthly? Weekly? Cần monitor model performance decay để quyết định
4. **Capital allocation:** Bao nhiêu vốn dành cho pilot? Ảnh hưởng đến position sizing
