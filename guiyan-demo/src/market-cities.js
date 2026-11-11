export function marketCities(resources, current) {
  return [
    ...new Set(
      [
        "南宁",
        "柳州",
        "桂林",
        "北海",
        "崇左",
        "河池",
        ...resources.map((r) => r.city),
        current,
      ].filter(Boolean),
    ),
  ];
}
