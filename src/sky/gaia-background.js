import * as THREE from 'three';

export function createGaiaBackground(texture) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uWorldToEquatorial: { value: new THREE.Matrix3() },
      uBrightness: { value: 0.7 },
      uSunAltitude: { value: -90 },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDirection;
      uniform sampler2D uTexture;
      uniform mat3 uWorldToEquatorial;
      uniform float uBrightness;
      uniform float uSunAltitude;
      const mat3 icrsToGalactic = mat3(
        -0.0548755604, 0.4941094279, -0.8676661490,
        -0.8734370902, -0.4448296300, -0.1980763734,
        -0.4838350155, 0.7469822445, 0.4559837762
      );
      void main() {
        vec3 eq = normalize(uWorldToEquatorial * normalize(vDirection));
        vec3 icrs = vec3(eq.x, -eq.z, eq.y);
        vec3 gal = normalize(icrsToGalactic * icrs);
        float lon = atan(gal.y, gal.x);
        float lat = asin(clamp(gal.z, -1.0, 1.0));
        vec2 uv = vec2(fract(0.5 - lon / 6.28318530718), 0.5 - lat / 3.14159265359);
        vec3 rgb = texture2D(uTexture, uv).rgb;
        float nightFade = 1.0 - smoothstep(-8.0, 2.0, uSunAltitude);
        float daylightFade = mix(1.0, 0.12, smoothstep(-8.0, 10.0, uSunAltitude));
        gl_FragColor = vec4(rgb * uBrightness, 0.55 * nightFade * daylightFade);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    transparent: true,
  });
  material.blending = THREE.NormalBlending;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(448, 96, 64), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

export function loadGaiaTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  }).then((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  });
}
