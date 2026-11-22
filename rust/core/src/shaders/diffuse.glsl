vec2 q=vec2((x-0.39*cos(s))*(1.35-a*0.92), (y+(b-0.5)*1.9+0.28*sin(s))*(1.45-d*0.68));
      float glow=exp(-dot(q,q));
      vec2 r=vec2((x+0.56*sin(s))*0.71,(y-0.61)*1.71);
      float halo=exp(-dot(r,r));
      return 0.025+glow*(0.84+0.18*k)+halo*c*(0.52-0.51*glow);
