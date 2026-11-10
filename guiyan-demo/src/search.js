const aliases = [
  ["壮锦", "织锦", "织造"],
  ["绣球", "抛绣球"],
  ["山歌", "民歌"],
  ["非遗", "非物质文化遗产"],
  ["文创", "文化创意"],
  ["场馆", "场地", "剧场"],
];
const lexicon = [
  ...new Set([
    ...aliases.flat(),
    "南宁",
    "柳州",
    "桂林",
    "北海",
    "崇左",
    "河池",
    "演出",
    "音乐会",
    "亲子",
    "设备",
    "艺人",
    "租赁",
    "体验",
  ]),
].sort((a, b) => b.length - a.length);
const splitWords = new RegExp("(" + lexicon.join("|") + ")", "g");
export function matchesSearch(resource, query) {
  const text = [
    resource.name,
    resource.description,
    resource.city,
    ...(resource.tags || []),
  ]
    .join(" ")
    .toLowerCase();
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/[\s,，、;；]+/)
    .flatMap((token) =>
      text.includes(token) ? [token] : token.split(splitWords).filter(Boolean),
    );
  return tokens.every((token) => {
    const group = aliases.find((g) => g.includes(token));
    return (group || [token]).some((word) => text.includes(word));
  });
}
export function rankRecommendations(resources, recommendations = []) {
  const byId = new Map(recommendations.map((r) => [r.resourceId, r]));
  return resources
    .map((r) => ({ ...r, recommendationReason: byId.get(r.id)?.reason }))
    .sort(
      (a, b) =>
        (byId.get(b.id)?.score || 0) - (byId.get(a.id)?.score || 0) ||
        a.id - b.id,
    );
}
