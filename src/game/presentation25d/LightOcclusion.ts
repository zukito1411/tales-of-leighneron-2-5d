/** Shared soft depth visibility for both the halo and the darkness pocket.
 * Four source taps span one depth pixel: a leaf/frame edge cannot switch an
 * entire light on/off. The per-fragment check still clips foreground walls.
 * Bias is in world units, independent of zoom, viewport size and GPU depth. */
export const lightOcclusionShader=`
float lightEyeDepth(sampler2D map,vec2 uv,vec2 clip){
  float raw=texture2D(map,clamp(uv,vec2(0.0),vec2(1.0))).r;
  return clip.x*clip.y/(clip.y-raw*(clip.y-clip.x));
}
float lightDepthVisibility(sampler2D map,vec2 uv,float source,vec2 clip,float bias){
  return smoothstep(-bias-3.0,-bias,lightEyeDepth(map,uv,clip)-source);
}
float lightSourceVisibility(sampler2D map,vec2 uv,float source,vec2 clip,vec2 texel,float bias){
  vec2 p=texel*.65;
  return .25*(lightDepthVisibility(map,uv+p,source,clip,bias)
    +lightDepthVisibility(map,uv-p,source,clip,bias)
    +lightDepthVisibility(map,uv+vec2(p.x,-p.y),source,clip,bias)
    +lightDepthVisibility(map,uv+vec2(-p.x,p.y),source,clip,bias));
}
float lightVisibility(sampler2D map,vec2 sourceUV,vec2 pixelUV,float source,vec2 clip,vec2 texel,float bias){
  return lightSourceVisibility(map,sourceUV,source,clip,texel,bias)
    *lightDepthVisibility(map,pixelUV,source,clip,bias);
}
`;
