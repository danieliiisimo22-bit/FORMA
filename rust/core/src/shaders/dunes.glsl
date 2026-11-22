float wave=(0.13+b*0.38)*(sin(x*1.42+s+0.86*y)+0.30*cos(x*2.81-y*1.2+s*0.73));
    float ground=y+0.78-d*1.14-wave;
    float bands=ground*(1.7+a*3.2+k*1.35);
    float layer=floor(bands), depth=fract(bands);
    float light=0.5+0.5*cos(x*1.42+s+0.86*y);
    float glow=0.5+0.5*cos(x*1.26+s*0.6);
    float sky=0.44+0.27*exp(-abs(ground)*1.75)*(0.58+0.42*glow);
    float far=exp(-max(layer,0.0)*0.40);
    float sand=0.66+0.13*light+0.10*far
      -(0.16+c*0.35)*exp(-depth*(1.6+light*1.4))*(1.0-0.61*far);
    sand+=0.028*sin(depth*40.0+x*1.7)*depth*(1.0-depth)*(1.0-far);
    return mix(sky,sand,smoothstep(-0.008,0.008,ground));
