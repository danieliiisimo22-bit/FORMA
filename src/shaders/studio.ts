export const vertex = `#version 300 es
void main() {
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`

export const fragment = (source: string) => `#version 300 es
precision highp float;
precision highp int;
out vec4 pixel;
uniform vec2 uSize, uOrigin;
uniform float uTileHeight;
uniform vec4 uParams, uLayout, uSym, uFinish;
uniform vec4 uGeometry;
uniform vec3 uGrades;
uniform sampler2D uRamp;
const float TAU=6.283185307179586;
vec2 rot(vec2 p, float a) {
  float c=cos(a), s=sin(a);
  return vec2(p.x*c-p.y*s,p.x*s+p.y*c);
}
float hash(vec2 p) {
  vec3 q=fract(p.xyx*0.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
float noise(vec2 p) {
  vec2 g=floor(p), f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash(g),hash(g+vec2(1,0)),f.x),
             mix(hash(g+vec2(0,1)),hash(g+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {
  return 0.57*noise(p)+0.28*noise(p*2.07+vec2(7.2,3.1))+0.15*noise(p*4.17+vec2(-2.3,8.4));
}
vec2 fold(vec2 p) {
  float mode=uGeometry.w;
  if (mode==0.0) return p;
  p=rot(p,-uSym.y);
  if (mode==2.0 || mode==4.0) p.y=abs(p.y);
  if (mode==1.0 || mode==3.0 || mode==4.0) p.x=abs(p.x);
  if (mode>=5.0) {
    float radius=length(p), sector=TAU/uSym.x;
    float t=mod(atan(p.y,p.x)-uSym.z+sector*0.5,sector)-sector*0.5;
    if(mode==6.0) t=abs(t);
    t+=uSym.w*0.25*sin(radius*6.0+t*uSym.x);
    p=vec2(cos(t),sin(t))*radius;
  } else {
    p.x+=uSym.w*sin(p.y*7.0+uSym.z)*0.07;
    p.y+=uSym.w*sin(p.x*7.0-uSym.z)*0.07;
  }
  return rot(p,uSym.y);
}
float field(float x,float y,float a,float b,float c,float d,float k,float s) {
  ${source}
}
float tone(vec2 p) {
  p=rot(fold(p),uGeometry.x)*uGeometry.y+vec2(uGeometry.z,uLayout.w);
  float t=field(p.x,p.y,uParams.x,uParams.y,uParams.z,uParams.w,uLayout.y,uLayout.x);
  if(uGrades.y>0.0){
    float accent=0.5+0.5*sin((p.x*0.72-p.y*0.43)*TAU+uLayout.x+noise(p));
    t=mix(t,t*0.48+accent*0.52,uGrades.y);
  }
  return clamp((t-0.5)*uGrades.x+0.5,0.0,1.0);
}
vec3 color(float t) {
  return texture(uRamp,vec2((clamp(t,0.0,1.0)*511.0+0.5)/512.0,0.5)).rgb;
}
uint scramble(uvec2 v) {
  uint h=(v.x+313u*uvec2(uLayout.z).x)*374761393u+(v.y+17u)*668265263u;
  h=(h^(h>>13u))*1274126177u;
  return h^(h>>16u);
}
void main() {
  vec2 xy=uOrigin+vec2(gl_FragCoord.x,uTileHeight-gl_FragCoord.y);
  vec2 p=(2.0*xy-uSize)/min(uSize.x,uSize.y);
  float t=tone(p);
  float mode=uFinish.x, amount=uFinish.y;
  float rnd=float(scramble(uvec2(xy))&65535u)/65535.0-0.5;
  if(mode==3.0) t+=(0.5-length(fract(p*58.0)-0.5))*amount*0.40;
  if(mode==4.0) {
    float d=0.015+amount*0.050;
    float neighbors=tone(p+vec2(d,0))+tone(p-vec2(d,0))+tone(p+vec2(0,d))+tone(p-vec2(0,d));
    t=mix(t,neighbors*0.25,amount);
  }
  if(mode==5.0) {
    float light=max(t,max(tone(p+vec2(0.055,0.018)),tone(p-vec2(0.055,0.018))));
    t+=max(light-0.48,0.0)*amount*0.33;
  }
  if(mode==6.0) t-=smoothstep(0.45,1.9,length(p))*amount*0.26;
  if(mode==7.0) {
    float levels=21.0-floor(17.0*amount);
    t=mix(t,floor(t*levels+0.5)/levels,amount);
  }
  if(mode==8.0) t+=(cos(p.x*122.0+p.y*168.0)*0.038+rnd*0.039)*amount;
  if(mode==9.0) t+=(fbm(p*94.0)-0.5)*amount*0.15;
  vec3 rgb=color(t);
  if(mode==1.0) rgb+=rnd*amount*0.12;
  if(mode==2.0) rgb+=(rnd*0.091+(noise(p*176.0)-0.5)*0.13)*amount;
  if(mode==10.0) {
    vec3 red=color(tone(p+vec2(amount*0.026,0.0)));
    vec3 blue=color(tone(p-vec2(amount*0.026,0.0)));
    rgb.r=red.r;
    rgb.b=blue.b;
  }
  pixel=vec4(clamp(rgb+rnd*uGrades.z/255.0,0.0,1.0),1);
}`
