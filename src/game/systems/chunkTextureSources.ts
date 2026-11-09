/** A complete streamed scenery chunk must be published only after every
 * distinct GPU texture source is ready. Many trees, flowers and leaves share
 * atlas sources: checking them per actor on every upload-wait frame is wasted
 * work. Preserve source identity (not the texture key) so independent canvas
 * or dynamic sources are never accidentally collapsed.
 *
 * This pure helper does not allocate textures or change any visual output. */
export function uniqueChunkSources<Source>(
  ...groups:ReadonlyArray<ReadonlyArray<{readonly frame:{readonly source:Source}}>>
):Set<Source>{
  const sources=new Set<Source>();
  for(const group of groups)for(const object of group)sources.add(object.frame.source);
  return sources;
}
