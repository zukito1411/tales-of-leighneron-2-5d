/** Three.js emits one WebGL bufferSubData per separated update range.
 * At 90/120/144 Hz many tiny scattered updates can cost more driver time
 * than uploading some unmodified bytes between adjacent instances.
 *
* All touched slots are covered exactly. The returned [start,end) pairs are
 * in instance-slot units; caller converts to BufferAttribute components.
 * Scratch output is reused per attribute, avoiding per-frame allocations.
 */
export const MAX_INSTANCE_UPLOAD_GROUPS=4;
export const MAX_COALESCE_GAP_SLOTS=12;
export function planInstanceUploadRanges(
  dirtySlots:readonly number[],first:number,end:number,out:number[],
  maxGroups=MAX_INSTANCE_UPLOAD_GROUPS,gapSlots=MAX_COALESCE_GAP_SLOTS
):number[]{
  out.length=0;
  if(end<=first)return out;
  // On heavily modified batches a single upload is cheaper than 32+
  // JS+driver calls; it also preserves the existing large-batch behavior.
  if(dirtySlots.length===0||dirtySlots.length>32){
    out.push(first,end);return out;
  }
  let start=dirtySlots[0],last=start;
  for(let i=1;i<dirtySlots.length;i++){
    const slot=dirtySlots[i];
    // This is a conservative fallback: should never trigger for normal
    // ordered batch submission, but must not omit any earlier dirty slot.
    if(slot<last){out.length=0;out.push(first,end);return out;}
    if(slot-last<=gapSlots+1){last=slot;continue;}
    out.push(start,last+1);
    if(out.length/2>=maxGroups){out.length=0;out.push(first,end);return out;}
    start=last=slot;
  }
  out.push(start,last+1);
  return out;
}
