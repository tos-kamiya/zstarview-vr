export function buildAsterismsFromStars({ definitions, stars, createLabel }) {
  const bySourceId = new Map(
    stars
      .filter((s) => typeof s.sourceId === 'string' && s.sourceId.trim())
      .map((s) => [s.sourceId.trim().toUpperCase(), s]),
  );
  const asterismObjects = [];
  const asterismKeysBySourceId = new Map();

  for (const def of definitions) {
    const edgeStars = [];
    const memberStars = [];
    const seenMemberKeys = new Set();
    let ok = true;
    for (const edge of def.edges || []) {
      const [sourceA, sourceB] = Array.isArray(edge) ? edge : [];
      const keyA = String(sourceA || '').trim().toUpperCase();
      const keyB = String(sourceB || '').trim().toUpperCase();
      const starA = bySourceId.get(keyA);
      const starB = bySourceId.get(keyB);
      if (!keyA || !keyB || !starA || !starB) {
        ok = false;
        break;
      }
      edgeStars.push([starA, starB]);
      if (!seenMemberKeys.has(keyA)) {
        memberStars.push(starA);
        seenMemberKeys.add(keyA);
      }
      if (!seenMemberKeys.has(keyB)) {
        memberStars.push(starB);
        seenMemberKeys.add(keyB);
      }
      const keysA = asterismKeysBySourceId.get(keyA) || [];
      if (!keysA.includes(def.key)) keysA.push(def.key);
      asterismKeysBySourceId.set(keyA, keysA);
      const keysB = asterismKeysBySourceId.get(keyB) || [];
      if (!keysB.includes(def.key)) keysB.push(def.key);
      asterismKeysBySourceId.set(keyB, keysB);
    }
    if (!ok || edgeStars.length === 0 || memberStars.length < 2) continue;
    asterismObjects.push({
      key: def.key,
      name: def.name,
      edgeStars,
      memberStars,
      label: createLabel(def),
    });
  }

  return { asterismObjects, asterismKeysBySourceId };
}
