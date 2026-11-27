// Recognition geometry extracted from Admin scratch/modal-poc/run.mjs (5cd6395).
const area = ([,,w,h]) => w * h;
const center = ([x,y,w,h]) => [x + Math.floor(w / 2), y + Math.floor(h / 2)];
const intersection = ([x,y,w,h], [u,v,a,b]) =>
  Math.max(0, Math.min(x+w,u+a)-Math.max(x,u)) * Math.max(0, Math.min(y+h,v+b)-Math.max(y,v));
const iou = (a,b) => intersection(a,b)/(area(a)+area(b)-intersection(a,b));

function contours(cv, mask, mode) {
  const vector = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.findContours(mask, vector, hierarchy, mode, cv.CHAIN_APPROX_SIMPLE);
    const result = [];
    for (let i = 0; i < vector.size(); i++) {
      const contour = vector.get(i);
      try {
        const { x, y, width, height } = cv.boundingRect(contour);
        const bbox = [x, y, width, height];
        result.push({ bbox, fill: Math.abs(cv.contourArea(contour)) / area(bbox) });
      } finally {
        contour.delete();
      }
    }
    return result;
  } finally {
    vector.delete();
    hierarchy.delete();
  }
}

function detect(cv, gray) {
  const mask = new cv.Mat();
  const edges = new cv.Mat();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  try {
    cv.threshold(gray, mask, 170, 255, cv.THRESH_BINARY);
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
    const panels = contours(cv, mask, cv.RETR_EXTERNAL).filter(({bbox, fill}) =>
      bbox[2] >= gray.cols * 0.18 && bbox[3] >= gray.rows * 0.17 &&
      area(bbox) < gray.rows * gray.cols * 0.75 && fill >= 0.8,
    ).sort((a,b) => area(b.bbox) - area(a.bbox));
    const panel = panels[0];
    if (!panel) return { modal_bbox: null, modal_confidence: null, buttons: [] };
    const [x,y,w,h] = panel.bbox;
    const roi = gray.roi(new cv.Rect(x,y,w,h));
    try {
      cv.Canny(roi, edges, 22, 55);
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
      const candidates = contours(cv, edges, cv.RETR_LIST).filter(({bbox: [u,v,bw,bh], fill}) =>
        u >= 3 && v >= 3 && u+bw <= w-3 && v+bh <= h-3 &&
        bh >= h*0.105 && bh <= h*0.24 && bw >= bh && bw <= w*0.65 && fill >= 0.78,
      ).sort((a,b) => area(b.bbox)-area(a.bbox));
      const buttons = [];
      for (const { bbox: [u,v,bw,bh], fill } of candidates) {
        const bbox = [x+u,y+v,bw,bh];
        if (buttons.some(button => iou(button.bbox,bbox) > 0.5)) continue;
        const cross = bw/bh < 1.45 ? crossScore(gray,bbox) : 0;
        if (cross < 0.55 && v+bh/2 < h*0.62) continue;
        buttons.push({ bbox, center: center(bbox), kind: cross >= 0.55 ? 'x' : 'confirmation',
          confidence: Number((0.56 + 0.35 * fill + 0.08 * cross).toFixed(3)) });
      }
      return { modal_bbox: panel.bbox, modal_confidence: Number(panel.fill.toFixed(3)), buttons };
    } finally {
      roi.delete();
    }
  } finally {
    mask.delete();
    edges.delete();
    kernel.delete();
  }
}

// Compare both dark diagonal strokes and the empty space around them.
function crossScore(gray, bbox) {
  const [x,y] = center(bbox);
  const radius = Math.round(bbox[3] * 0.18);
  let best = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      let on = 0, off = 0, onCount = 0, offCount = 0;
      for (let v = -radius; v <= radius; v++) {
        for (let u = -radius; u <= radius; u++) {
          const dark = gray.ucharAt(y+v+dy,x+u+dx) < 170;
          const distance = Math.min(Math.abs(u-v), Math.abs(u+v));
          if (distance <= 1) {
            on += Number(dark);
            onCount++;
          } else if (distance >= 3) {
            off += Number(dark);
            offCount++;
          }
        }
      }
      best = Math.max(best, on/onCount - off/offCount);
    }
  }
  return best;
}

export function detectModal(cv, { data, width, height }) {
  const rgba = cv.matFromImageData({ data, width, height });
  const gray = new cv.Mat();
  try {
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    const result = detect(cv, gray);
    const normalize = ([x, y, w, h]) => [x / width, y / height, w / width, h / height];
    return {
      viewport: { width, height },
      modal: result.modal_bbox && normalize(result.modal_bbox),
      confidence: result.modal_confidence,
      buttons: result.buttons.map(({ bbox, kind, confidence }) => ({
        box: normalize(bbox), kind, confidence,
      })),
    };
  } finally {
    gray.delete();
    rgba.delete();
  }
}
