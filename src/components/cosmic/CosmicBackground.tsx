import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function radialTexture(inner: string, outer: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, outer);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function CosmicBackground() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0719);
    scene.fog = new THREE.FogExp2(0x0b0719, 0.016);

    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 260);
    const camBase = new THREE.Vector3(0, 6, 14);
    camera.position.copy(camBase);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x88b4d4, 1.2));
    const dir = new THREE.DirectionalLight(0xcfeaff, 0.9);
    dir.position.set(6, 12, 8);
    scene.add(dir);
    scene.add(new THREE.HemisphereLight(0xf472b6, 0x0a0f1e, 0.45));

    // stars sphere
    const starGeo = new THREE.BufferGeometry();
    const N = 900;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 55 + Math.random() * 90;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x9fd8ff, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.72, fog: false }),
    );
    scene.add(stars);

    // nebulas
    function nebula(color: string, x: number, y: number, z: number, s: number, o: number) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: radialTexture(color, 'rgba(139,92,246,0)'),
          transparent: true,
          opacity: o,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
        }),
      );
      sp.position.set(x, y, z);
      sp.scale.set(s, s, 1);
      scene.add(sp);
      return sp;
    }
    nebula('rgba(236,72,153,0.20)', -14, 7, -30, 42, 0.45);
    nebula('rgba(139,92,246,0.16)', 16, 10, -26, 40, 0.4);
    nebula('rgba(192,132,252,0.11)', 8, -6, -32, 48, 0.35);
    nebula('rgba(244,114,182,0.12)', -4, 12, -34, 34, 0.35);

    // subtle grid on far plane
    const grid = new THREE.GridHelper(60, 40, 0x3b1f5a, 0x1e1b4b);
    grid.position.y = -6;
    (grid.material as THREE.Material & { transparent?: boolean; opacity?: number }).transparent = true;
    (grid.material as any).opacity = 0.22;
    scene.add(grid);

    let px = 0, py = 0;
    const onMove = (e: PointerEvent) => {
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('pointermove', onMove);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    let visible = true;
    const onVis = () => { visible = !document.hidden; if (visible) loop(); };
    document.addEventListener('visibilitychange', onVis);

    const loop = () => {
      if (document.hidden) return;
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      stars.rotation.y = t * 0.006;
      stars.rotation.x = Math.sin(t * 0.04) * 0.02;
      camera.position.set(camBase.x + px * 2.2, camBase.y + py * 1.2, camBase.z);
      camera.lookAt(0, 0, -2);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      starGeo.dispose();
      (stars.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={wrapRef} className="cosmic-bg" aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
