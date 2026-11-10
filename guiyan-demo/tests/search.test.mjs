import test from "node:test";
import assert from "node:assert/strict";
import { matchesSearch } from "../src/search.js";
test("多词搜索要求全部命中，支持常见连续中文词与同义词", () => {
  const r = {
    name: "壮乡山歌手作",
    city: "南宁",
    description: "非遗壮锦体验",
    tags: ["民族文化"],
  };
  for (const query of [
    "南宁 民歌",
    "南宁山歌",
    "织锦 体验",
    "非物质文化遗产，山歌",
  ])
    assert.equal(matchesSearch(r, query), true, query);
  for (const query of ["桂林 山歌", "壮锦 不存在的词", "山歌 音乐会"])
    assert.equal(matchesSearch(r, query), false, query);
});
