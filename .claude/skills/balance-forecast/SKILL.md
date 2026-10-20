---
name: balance-forecast
description: 共有口座残高と今月の収支の未来の推移を、対象月までの実績の中央値(収支+積立貯金)で算出する式。ダッシュボードのグラフに未来分を出したいときや、予測値の計算・確認をするときに使う。
---

# 共有口座残高の未来推移の算出

ダッシュボードのグラフは、対象月から遡って直近1年間の実績だけを表示している。
未来の推移(対象月より後)を出す場合は、このスキルの式を使う。

## 式

対象月を `T`、中央値の対象期間を `MEDIAN_BUDGET_FROM`(2025-12)〜`T` とする。

1. 期間内の各月 `m` について、`summarizeMonth` の結果から次の2つを集める。
   - `net[m]` = `surplus + bankIncome`(今月の収支。積立貯金の予算−実績の差額だけを含む)
   - `sav[m]` = `savingsActual`(積立貯金の実績)
2. `medianNet = median(net)`、`medianSav = median(sav)`(`lib/calc.ts` の `median`。偶数件は中央2件の平均)
3. 対象月 `T` の残高 `B[T]` は実績どおり(`pool + savings`。画面の「現在の共有口座残高」と一致する)。
4. `T` より後の月 `k` (T+1, T+2, ...) は前月残高に加算する。

```
B[k]   = B[k-1] + medianNet + medianSav
net[k] = medianNet        // 今月の収支の推移の線(積立貯金は含めない)
```

## 実装の置き場所

`lib/calc.ts` の `computeDashboard` で、対象月までのループの後に追加する。
`actualNets` と `actualSavings` を `mk >= MEDIAN_BUDGET_FROM && mk <= monthStr` の月で集め、
`history` に未来の月の `{ month, net: medianNet, balance }` を足す。
グラフ側(`components/DashboardTab.tsx` の `yearMonths`)は、表示する月に未来分も含める。

```ts
if (actualNets.length > 0) {
  const medianNet = median(actualNets);
  const medianSavings = median(actualSavings);
  let projected = history[history.length - 1].balance; // 対象月の実績残高
  for (let i = 1; i <= horizon; i++) {
    projected += medianNet + medianSavings;
    history.push({ month: monthKey(addMonths(target, i)), net: medianNet, balance: projected });
  }
}
```

## 注意点

- 取引や実績が未入力の月は、収支が「予算総額−0」になり大きく出る。対象月は実績が入っている月にする。
- 中央値の期間に積立貯金が0円の月が多いと、`medianSav` は小さくなる。
- 対象月の実績は画面のカードと同じ値を使う。対象月を予測値で置き換えない。

## シミュレーターの表示

式を画面で確認したいと言われたら、同じフォルダの `simulator.html` を Artifact として公開する。

1. `.claude/skills/balance-forecast/simulator.html` をそのまま `Artifact` で公開する(アイコンは `chart`)。
2. 初期値は例の数字(`SAMPLE` と対象月の残高 `172273`)。ユーザーがダッシュボードの数字
   (対象月の残高、月別の収支と積立貯金実績)を渡したときは、`SAMPLE` と `#balance` の `value` をその数字に書き換えてから公開する。
   例の数字のままのときは、画面の「例の数字」の表示を残す。実際の数字に差し替えたら、そのタグは削除する。
3. 同じ会話で再公開するときは、同じファイルパスで公開して URL を保つ。
4. DB へ直接アクセスして数字を取らない。数字はユーザーから受け取る。
