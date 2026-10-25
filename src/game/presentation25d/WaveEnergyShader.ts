/** Only the traveling energy mesh uses these attributes/branches. Its clock is
 * the skill's active-play time, not wall time, so menus freeze its motion. */
export const waveVertexDeclarations=`
#ifdef WAVE_ENERGY
attribute vec4 waveStyle;
varying vec4 energyStyle;
#endif
`;
export const waveVertexMotion=`
#ifdef WAVE_ENERGY
  energyStyle=waveStyle;
  if(waveStyle.z>2.5&&waveStyle.z<3.5){
    float age=fract(tileRepeat.x*.85+waveStyle.w);
    presentedPosition.x-=age*.1;
    presentedPosition.y+=sin(age*3.141593)*.07;
  }else if(waveStyle.z>1.5&&waveStyle.z<2.5){
    presentedPosition.y+=sin(tileRepeat.x*9.0+waveStyle.x*8.0+waveStyle.w*13.0)*.018*sin(waveStyle.x*3.141593);
  }
#endif
`;
export const waveFragmentDeclarations=`
#ifdef WAVE_ENERGY
varying vec4 energyStyle;
vec4 waveEnergyPixel(vec4 paint){
  float time=effectData.x,s=energyStyle.x,b=energyStyle.y,role=energyStyle.z,seed=energyStyle.w;
  // Derive the hue from the approved painting and equipped weapon tint. Hot
  // highlights stay white, including red/gold weapons, instead of flat tint.
  vec3 pigment=texture2D(atlas,frameRect.xy+vec2(.48,.5)*frameRect.zw).rgb*tint.rgb;
  vec3 hue=pigment/max(.001,max(pigment.r,max(pigment.g,pigment.b)));
  vec2 flowUV=vec2(fract(s*.83-time*.37+seed*.7),clamp(.24+b*.5,.04,.96));
  float detail=dot(texture2D(atlas,frameRect.xy+flowUV*frameRect.zw).rgb,vec3(.299,.587,.114));
  if(role<.5){
    float line=.16+.055*sin(s*25.0-time*6.0)+.05*(detail-.5);
    float core=exp(-pow((b-line)*14.0,2.0));
    float strand1=exp(-abs(b-(.36+.1*sin(s*17.0+detail*6.0+time*4.0)))*38.0);
    float strand2=exp(-abs(b-(.58+.13*sin(s*29.0+detail*9.0-time*7.0)))*42.0);
    float edge=smoothstep(0.0,.09,b)*(1.0-smoothstep(.58,1.0,b));
    paint.rgb=mix(paint.rgb,hue*(.25+detail*.65),.6)+vec3(5.0)*core+hue*(strand1+strand2)*.8;
    float fieldAlpha=edge*(.25+.5*detail)*(gl_FrontFacing?.72:.36);
    // The world target is normalized color: a brighter RGB value alone is
    // clamped before alpha blending. Give the narrow hot core its own opacity.
    paint.a=max(fieldAlpha,edge*smoothstep(.45,.9,core)*.98);
  }else if(role<1.5){
    float envelope=pow(max(0.0,sin(b*3.141593)),1.7);
    paint.rgb=hue*.8;paint.a=envelope*(.2+detail*.15);
  }else if(role<2.5){
    float cross=pow(max(0.0,1.0-abs(b*2.0-1.0)),1.7);
    float streak=exp(-abs(b-.5-.12*sin(s*16.0-time*8.0+seed*5.0))*19.0);
    paint.rgb=hue*(.45+detail*.9)+vec3(.1)*streak;
    paint.a=cross*sin(s*3.141593)*(.25+.55*detail);
  }else if(role<3.5){
    float radius=abs(s)+abs(b),core=exp(-radius*radius*28.0);
    float pulse=.3+.7*pow(.5+.5*sin(time*12.0+seed*29.0),3.0);
    paint.rgb=mix(hue,vec3(1.4),core);
    paint.a=(1.0-smoothstep(.08,1.0,radius))*pulse;
  }else{
    float core=exp(-abs(b-.3-.07*sin(s*22.0-time*7.0+seed))*26.0);
    paint.rgb=hue*(.6+detail*.5)+vec3(1.4)*core;
    paint.a=sin(b*3.141593)*(.3+.5*detail);
  }
  return paint;
}
#endif
`;
