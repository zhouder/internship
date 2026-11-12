export const chartBounds = {left:64, right:590, top:24, bottom:204, width:620, height:270};

export function amountScale(amounts) {
  const peak = Math.max(0, ...amounts);
  if (!peak) return {max:10000, ticks:[0,2500,5000,7500,10000]};
  const base = 10 ** Math.floor(Math.log10(Math.max(100, peak)));
  const ceiling = [1,2,3,4,5,6,8,10].find(n => n * base >= Math.max(100, peak));
  const max = ceiling * base;
  const steps = [3,6].includes(ceiling) ? 3 : [5,10].includes(ceiling) ? 5 : 4;
  return {max, ticks:Array.from({length:steps + 1}, (_, i) => max * i / steps)};
}

export function tickIndices(length, period, limit = period === "day" ? 7 : 6, minimumStep = 1) {
  for (let count = Math.min(length, limit); count > 1; count--) {
    const indices = Array.from({length:count}, (_, i) => Math.round(i * (length - 1) / (count - 1)));
    if (indices.every((index, i) => i === 0 || index - indices[i-1] >= minimumStep)) return indices;
  }
  return length ? [0] : [];
}

export function tickLines(point, period) {
  if (period === "week") {
    const start = point.date;
    const end = new Date(new Date(start + "T00:00:00Z").getTime() + 6 * 86400000).toISOString().slice(5,10);
    return [start.slice(5).replace("-", "/"), "至 " + end.replace("-", "/")];
  }
  if (period === "day") return [point.date.slice(5).replace("-", "/")];
  if (period === "month") return [point.date.replace("-", "/")];
  return [point.date.replace(/^(\d{2})(\d{2}) /, "$2 ")];
}
