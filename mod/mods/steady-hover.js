// Steady hover – texts no longer shake when the cursor is at their edge.
//
// In the device editors a hovered label slides 20 px to the right (and gets a bolder font). With the cursor over the
// first letters, the label slides out from under it, the hover ends, the label slides back under the cursor, and so
// on: the text shakes (x 113…117 several times a second). Here a text that is hovered stays hovered while the cursor
// is anywhere between where it was when the hover began and where it is now, as long as the cursor is still on the
// text's line and the text moved sideways by at most 40 px. A label that scrolls away in a list is not kept.
// Only the engine's "cursor is over / clicked on object" test of Text objects changes; the animation stays as it is.
BetterDTKit.mod('steady-hover', {
  needs: {
    check: () => {
      const C = self.C3;
      return C && C.WorldInfo && C.WorldInfo.prototype.ContainsPoint && C.CollisionEngine
        && C.CollisionEngine.prototype.TestAndSelectCanvasPointOverlap && C.Plugins.Text && C.Plugins.Text.Instance
        ? '' : 'engine point test';
    },
  },
}, (rt, kit) => {
  const C = self.C3, WI = C.WorldInfo.prototype, CE = C.CollisionEngine.prototype;
  const origContains = WI.ContainsPoint, origTest = CE.TestAndSelectCanvasPointOverlap;
  const MAX_SHIFT = 40;
  const isText = new WeakMap();   // WorldInfo -> boolean
  const start = new WeakMap();    // WorldInfo -> bounding box when its hover began
  let inTest = 0;

  const box = (wi) => { const b = wi.GetBoundingBox(); return { l: b.getLeft(), t: b.getTop(), r: b.getRight(), b: b.getBottom() }; };
  function text(wi) {
    let v = isText.get(wi);
    if (v === undefined) {
      try { v = wi._inst.GetSdkInstance() instanceof C.Plugins.Text.Instance; } catch { v = false; }
      isText.set(wi, v);
    }
    return v;
  }
  const keep = kit.guard(function (wi, x, y) {
    const s = start.get(wi);
    if (!s) return false;
    const c = box(wi);
    const ok = y >= c.t && y <= c.b && Math.abs(c.l - s.l) <= MAX_SHIFT
      && x >= Math.min(s.l, c.l) && x <= Math.max(s.r, c.r);
    if (!ok) start.delete(wi);
    return ok;
  });

  CE.TestAndSelectCanvasPointOverlap = function () {
    inTest++;
    try { return origTest.apply(this, arguments); } finally { inTest--; }
  };
  WI.ContainsPoint = function (x, y) {
    const hit = origContains.call(this, x, y);
    if (!inTest || !text(this)) return hit;
    if (hit) {
      if (!start.has(this)) start.set(this, box(this));
      return true;
    }
    return keep(this, x, y) === true;
  };

  return () => {
    CE.TestAndSelectCanvasPointOverlap = origTest;
    WI.ContainsPoint = origContains;
  };
});
