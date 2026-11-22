vec2 p=vec2(x,y)*(1.45+a*3.7+k*2.2)+s;
    vec2 g=floor(p), f=fract(p);
    float first=10.0, second=10.0, id=0.0;
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
      vec2 cell=vec2(float(i),float(j));
      vec2 v=cell+0.5+(vec2(hash(g+cell),hash(g+cell+21.7))-0.5)*b-f;
      float dist=dot(v,v);
      if(dist<first){second=first;first=dist;id=hash(g+cell+11.0);}
      else if(dist<second){second=dist;}
    }
    float edge=smoothstep(0.006,0.03+c*0.13,sqrt(second)-sqrt(first));
    return mix(0.13,0.47+id*0.40-d*sqrt(first)*0.37,edge);
