import * as THREE from 'three';

export const RainShader = {
  uniforms: {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2() },
    iMouse: { value: new THREE.Vector2() },
    iChannel0: { value: null },
    uIntensity: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    #define S(a, b, t) smoothstep(a, b, t)

    uniform float iTime;
    uniform vec2 iResolution;
    uniform vec2 iMouse;
    uniform sampler2D iChannel0;
    uniform float uIntensity;

    varying vec2 vUv;
    
    vec3 renderMeteor(vec2 uv, float time, vec2 resolution) {
        float t = mod(time, 60.0);
        float duration = 4.0; // Slower speed
        if (t > duration) return vec3(0.0);

        float aspect = resolution.x / resolution.y;
        vec2 p = uv;
        p.x *= aspect;
        
        // Horizontal path at the top of the input box (around y=0.82)
        vec2 startPos = vec2(-0.3 * aspect, 0.82);
        vec2 endPos = vec2(1.3 * aspect, 0.82);
        
        float progress = t / duration;
        vec2 headPos = mix(startPos, endPos, progress);
        vec2 dir = normalize(endPos - startPos);
        
        vec2 relPos = p - headPos;
        float proj = dot(relPos, dir);
        float distToLine = length(relPos - proj * dir);
        
        // Meteor head
        float head = smoothstep(0.0015, 0.0, length(relPos));
        
        // Core glow (extremely tight)
        float headGlow = smoothstep(0.004, 0.0, length(relPos)) * 0.4;
        
        // Minimal soft halo
        float halo = smoothstep(0.01, 0.0, length(relPos)) * 0.03;
        
        float tailFade = 0.0;
        if (proj < 0.0) {
            float tailLen = 0.6;
            float d = abs(proj);
            if (d < tailLen) {
                float tailWidth = 0.001 * (1.0 - d/tailLen);
                tailFade = smoothstep(tailWidth, 0.0, distToLine) * pow(1.0 - d/tailLen, 2.0);
            }
        }
        
        return vec3(head + headGlow + halo + tailFade) * 0.6;
    }

    vec3 N13(float p) {
       vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
       p3 += dot(p3, p3.yzx + 19.19);
       return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
    }

    float N(float t) {
        return fract(sin(t*12345.564)*7658.76);
    }

    float Saw(float b, float t) {
        return S(0., b, t)*S(1., b, t);
    }

    vec2 DropLayer2(vec2 uv, float t, vec2 mouse) {
        vec2 UV = uv;
        
        // Mouse interaction: shift grid based on mouse position
        uv.x -= mouse.x * 0.02 + sin(t * 0.2) * 0.005;
        uv.y += t * 0.75 - mouse.y * 0.02;
        
        vec2 a = vec2(6., 1.);
        vec2 grid = a*2.;
        vec2 id = floor(uv*grid);
        float colShift = N(id.x); 
        uv.y += colShift;
        id = floor(uv*grid);
        vec3 n = N13(id.x*35.2+id.y*2376.1);
        vec2 st = fract(uv*grid)-vec2(.5, 0);
        float x = n.x-.5;
        float y = UV.y*20.;
        float wiggle = sin(y+sin(y));
        x += wiggle*(.5-abs(x))*(n.z-.5);
        x *= .7;
        float ti = fract(t+n.z);
        y = (Saw(.85, ti)-.5)*.9+.5;
        vec2 p = vec2(x, y);
        float d = length((st-p)*a.yx);
        float mainDrop = S(.4, .0, d);
        float r = sqrt(S(1., y, st.y));
        float cd = abs(st.x-x);
        float trail = S(.23*r, .15*r*r, cd);
        float trailFront = S(-.02, .02, st.y-y);
        trail *= trailFront*r*r;
        y = UV.y;
        float trail2 = S(.2*r, .0, cd);
        float droplets = max(0., (sin(y*(1.-y)*120.)-st.y))*trail2*trailFront*n.z;
        y = fract(y*10.)+(st.y-.5);
        float dd = length(st-vec2(x, y));
        droplets = S(.3, 0., dd);
        float m = mainDrop+droplets*r*trailFront;
        return vec2(m, trail);
    }

    float StaticDrops(vec2 uv, float t) {
        uv *= 40.;
        vec2 id = floor(uv);
        uv = fract(uv)-.5;
        vec3 n = N13(id.x*107.45+id.y*3543.654);
        vec2 p = (n.xy-.5)*.7;
        float d = length(uv-p);
        float fade = Saw(.025, fract(t+n.z));
        float c = S(.3, 0., d)*fract(n.z*10.)*fade;
        return c;
    }

    vec2 Drops(vec2 uv, float t, float l0, float l1, float l2, vec2 mouse) {
        float s = StaticDrops(uv, t)*l0; 
        vec2 m1 = DropLayer2(uv, t, mouse)*l1;
        vec2 m2 = DropLayer2(uv*1.85, t, mouse)*l2;
        float c = s+m1.x+m2.x;
        c = S(.3, 1., c);
        return vec2(c, max(m1.y*l0, m2.y*l1));
    }

    void main() {
        vec2 fragCoord = vUv * iResolution;
        vec2 uv = (fragCoord.xy-.5*iResolution.xy) / iResolution.y;
        vec2 UV = fragCoord.xy/iResolution.xy;
        
        float T = iTime;
        float t = T*.2;
        
        // Normalize mouse to -1 to 1
        vec2 mouse = (iMouse.xy / iResolution.xy) * 2.0 - 1.0;
        
        // Intensity control linked to rainAmount
        float rainAmount = (sin(T*.05)*.3+.7) * uIntensity;
        
        // Fixed zoom as requested (removed -cos(T*.2) scaling)
        uv *= .8; // Fixed scale
        UV = (UV-.5)*.95+.5;
        
        float staticDrops = S(-.5, 1., rainAmount)*2.;
        float layer1 = S(.25, .75, rainAmount);
        float layer2 = S(.0, .5, rainAmount);
        
        vec2 c = Drops(uv, t, staticDrops, layer1, layer2, mouse);
        
        vec2 e = vec2(.001, 0.);
        float cx = Drops(uv+e, t, staticDrops, layer1, layer2, mouse).x;
        float cy = Drops(uv+e.yx, t, staticDrops, layer1, layer2, mouse).x;
        vec2 n = vec2(cx-c.x, cy-c.x);
        
        // Simplified rendering for WebGL1 compatibility as requested
        vec3 col = texture2D(iChannel0, UV+n).rgb;
        
        // Slightly brighter background as requested (0.5 -> 0.7)
        col *= 0.7;
        
        // Add a strong vignette effect to match the reference image
        float vignette = UV.x * UV.y * (1.0 - UV.x) * (1.0 - UV.y);
        vignette = pow(16.0 * vignette, 0.4); // Adjust power for vignette strength
        col *= vignette;
        
        // Add a more colorful misty/green-blue tint for "Jiangnan" feel
        vec3 tint = vec3(0.1, 0.2, 0.18); // Slightly more green/blue
        col = mix(col, tint, 0.25);
        
        // Add Meteor effect
        vec3 meteor = renderMeteor(vUv, iTime, iResolution);
        col += meteor;
        
        gl_FragColor = vec4(col, 1.);
    }
  `
};

export const SnowShader = {
  uniforms: {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2() },
    iMouse: { value: new THREE.Vector2() },
    iChannel0: { value: null },
    uIntensity: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float iTime;
    uniform vec2 iResolution;
    uniform vec2 iMouse;
    uniform sampler2D iChannel0;
    uniform float uIntensity;
    varying vec2 vUv;

    vec3 renderMeteor(vec2 uv, float time, vec2 resolution) {
        float t = mod(time, 60.0);
        float duration = 4.0; // Slower speed
        if (t > duration) return vec3(0.0);

        float aspect = resolution.x / resolution.y;
        vec2 p = uv;
        p.x *= aspect;
        
        // Horizontal path at the top of the input box (around y=0.82)
        vec2 startPos = vec2(-0.3 * aspect, 0.82);
        vec2 endPos = vec2(1.3 * aspect, 0.82);
        
        float progress = t / duration;
        vec2 headPos = mix(startPos, endPos, progress);
        vec2 dir = normalize(endPos - startPos);
        
        vec2 relPos = p - headPos;
        float proj = dot(relPos, dir);
        float distToLine = length(relPos - proj * dir);
        
        // Meteor head
        float head = smoothstep(0.0015, 0.0, length(relPos));
        
        // Core glow (extremely tight)
        float headGlow = smoothstep(0.004, 0.0, length(relPos)) * 0.4;
        
        // Minimal soft halo
        float halo = smoothstep(0.01, 0.0, length(relPos)) * 0.03;
        
        float tailFade = 0.0;
        if (proj < 0.0) {
            float tailLen = 0.6;
            float d = abs(proj);
            if (d < tailLen) {
                float tailWidth = 0.001 * (1.0 - d/tailLen);
                tailFade = smoothstep(tailWidth, 0.0, distToLine) * pow(1.0 - d/tailLen, 2.0);
            }
        }
        
        return vec3(head + headGlow + halo + tailFade) * 0.6;
    }

    #define LIGHT_SNOW 

    #ifdef LIGHT_SNOW
        #define LAYERS 50.
        #define DEPTH .5
        #define WIDTH .3
        #define SPEED .6
    #else // BLIZZARD
        #define LAYERS 200.
        #define DEPTH .1
        #define WIDTH .8
        #define SPEED 1.5
    #endif

    // Laser Beam Aurora function
    vec3 aurora(vec2 uv, float t) {
        vec3 auroraCol = vec3(0.0);
        
        // Create multiple vertical streaks (laser beams)
        for(float i=0.; i<5.; i++) {
            float xOffset = i * 0.35 + sin(t * 0.25 + i * 1.2) * 0.12;
            float dist = abs(uv.x - (0.15 + xOffset));
            
            // Soft "laser" beam
            float beam = smoothstep(0.06, 0.0, dist);
            
            // Vertical movement and flickering
            float wave = sin(uv.y * 4.0 + t * 0.6 + i) * 0.5 + 0.5;
            float flicker = fract(sin(i * 123.45 + t * 8.0)) * 0.15 + 0.85;
            beam *= wave * flicker;
            
            // Fade at top/bottom
            beam *= smoothstep(1.0, 0.4, uv.y) * smoothstep(0.0, 0.3, uv.y);
            
            // Colors: Blue dominant with subtle Green and Red
            vec3 blue = vec3(0.0, 0.3, 0.9);
            vec3 green = vec3(0.1, 0.8, 0.4);
            vec3 red = vec3(0.9, 0.1, 0.2);
            
            vec3 c = blue;
            if(i == 1.0) c = mix(blue, green, 0.4);
            if(i == 3.0) c = mix(blue, red, 0.3);
            
            // Reduce saturation for a natural look
            c = mix(c, vec3(0.1, 0.2, 0.3), 0.4);
            
            auroraCol += c * beam * 0.45;
        }
        
        // Add a subtle horizontal glow at the horizon
        float horizonGlow = smoothstep(0.6, 0.0, abs(uv.y - 0.2));
        auroraCol += vec3(0.02, 0.1, 0.2) * horizonGlow * 0.2;
        
        return auroraCol;
    }

    void main() {
        vec2 U = gl_FragCoord.xy;
        vec4 O = vec4(0.0);
        const mat3 p = mat3(13.323122, 23.5112, 21.71123,
                            21.1212,   28.7312, 11.9312,
                            21.8112,   14.7212, 61.3934  );
        
        // Mouse interaction: shift uv based on mouse position
        vec2 mouse = (iMouse.xy / iResolution.xy) * 2.0 - 1.0;
        float wind = sin(iTime * 0.3) * 0.02;
        vec2 uv = (U / iResolution.x) - mouse * 0.02 + vec2(wind, 0.0);
        
        float dof = 5. * sin(iTime * .1);
        
        for (float i = 0.; i < LAYERS; i++) {
            vec2 q = uv * (1. + i * DEPTH);
            float layerWobble = sin(iTime * 0.5 + i) * 0.05;
            q += vec2( q.y * WIDTH * ( fract(i * 7.238917) - .5 ) + layerWobble,
                       SPEED * iTime / (1. + i * DEPTH * .03) );
            vec3 n = vec3(floor(q), 31.189 + i),
                 m = floor(n) / 1e5 + fract(n),
                 mp = (31415.9 + m) / fract(p * m),
                 r = fract(mp);
            vec2 s = abs( fract(q) - .5 + .9 * r.xy - .45 )
                     + .01 * abs( 2. * fract(10. * q.yx) - 1. ); 
            float d = .6 * (s.x + s.y) + max(s.x, s.y) - .01,
               edge = .005 + .05 * min( .5 * abs(i - 5. - dof), 1.);
            
            // Accumulate snow flakes with intensity control
            O += smoothstep(edge, -edge, d) * r.x / (1. + .02 * i * DEPTH) * uIntensity;
        }
        
        // Sample background texture
        vec3 bg = texture2D(iChannel0, vUv).rgb;
        
        // Procedural aurora disabled to focus on the pure snow mountain landscape
        // vec3 aur = aurora(vUv, iTime);
        // bg = mix(bg, bg + aur * uIntensity * 1.5, 0.6);
        
        // Darken the background for better focus, but keep it atmospheric
        bg *= 0.4 + 0.1 * uIntensity;
        
        vec3 col = bg + O.rgb;
        
        // Add Meteor effect
        vec3 meteor = renderMeteor(vUv, iTime, iResolution);
        col += meteor;
        
        gl_FragColor = vec4(col, 1.0);
    }
  `
};
