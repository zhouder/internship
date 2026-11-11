import { inventoryMode } from "./review-upgrade.mjs";
export function createBookingSlots({ all, assert, int }) {
  function selection(r, b = {}) {
    const session = r.category === "show" ? b.sessionTime || "全天" : "全天";
    assert(["全天", "14:00", "19:30"].includes(session), "无效场次");
    const rental = inventoryMode(r) === "rental",
      start = rental ? b.startTime || "00:00" : "00:00",
      end = rental ? b.endTime || "24:00" : "24:00";
    assert(
      /^([01]\d|2[0-3]):[0-5]\d$/.test(start) &&
        (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end) || end === "24:00") &&
        start < end,
      "租赁开始时间必须早于结束时间",
    );
    const seats = b.seats ?? [];
    assert(Array.isArray(seats) && seats.length <= 100, "选座数量无效");
    assert(r.category === "show" || seats.length === 0, "该资源不支持选座");
    for (const n of seats)
      int(n, "座位编号", 1, Number(r.daily_capacity ?? r.stock));
    assert(new Set(seats).size === seats.length, "座位不能重复");
    return { session, start, end, seats };
  }
  async function availability(r, d, s = selection(r)) {
    const mode = inventoryMode(r),
      capacity = Number(r.daily_capacity ?? r.stock);
    let rows = await all(
      "SELECT quantity,session_time,seat_labels,start_time,end_time FROM orders WHERE resource_id=? AND booking_date=? AND status NOT IN ('cancelled','refunded')",
      r.id,
      d,
    );
    if (mode === "rental")
      rows = rows.filter((o) => o.start_time < s.end && o.end_time > s.start);
    if (r.category === "show" && s.session !== "全天")
      rows = rows.filter(
        (o) => o.session_time === "全天" || o.session_time === s.session,
      );
    const held = rows.reduce((n, o) => n + o.quantity, 0),
      occupied = new Set();
    let unknown = 0;
    for (const o of rows) {
      const seats = JSON.parse(o.seat_labels || "[]");
      for (const seat of seats) occupied.add(seat);
      unknown += Math.max(0, o.quantity - seats.length);
    }
    for (let n = 1; unknown > 0 && n <= capacity; n++)
      if (!occupied.has(n)) {
        occupied.add(n);
        unknown--;
      }
    return {
      mode,
      available:
        mode === "none"
          ? null
          : mode === "rental"
            ? rows.length
              ? 0
              : 1
            : mode === "date"
              ? Math.max(0, capacity - held)
              : r.stock,
      capacity,
      occupiedSeats: [...occupied],
      sessionTime: s.session,
      startTime: s.start,
      endTime: s.end,
    };
  }
  async function reserveSelection(r, d, qty, s) {
    const a = await availability(r, d, s);
    if (a.mode === "rental")
      assert(a.available === 1, "该时间段已被预约，请更换时段", 409);
    if (a.mode === "date") assert(a.available >= qty, "所选场次库存不足", 409);
    if (r.category !== "show") return [];
    if (s.seats.length) {
      assert(s.seats.length === qty, "选座数量与预约数量不一致");
      assert(
        s.seats.every((n) => !a.occupiedSeats.includes(n)),
        "座位已被预约，请刷新后重选",
        409,
      );
      return s.seats;
    }
    const seats = [];
    for (let n = 1; n <= a.capacity && seats.length < qty; n++)
      if (!a.occupiedSeats.includes(n)) seats.push(n);
    assert(seats.length === qty, "可用座位不足", 409);
    return seats;
  }
  return { selection, availability, reserveSelection };
}
