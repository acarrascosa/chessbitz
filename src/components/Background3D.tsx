import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, Lightformer, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const BRASS = '#d9b170';
const REST_X = 3.05;

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setReduced(media.matches);
        sync();
        media.addEventListener('change', sync);
        return () => media.removeEventListener('change', sync);
    }, []);
    return reduced;
}

const KingModel = ({ animate }: { animate: boolean }) => {
    const groupRef = useRef<THREE.Group>(null);
    const { scene } = useGLTF('/king.glb');

    const king = useMemo(() => {
        const clone = scene.clone();
        const material = new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.8, roughness: 0.3 });
        clone.traverse(child => {
            if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = material;
        });
        return clone;
    }, [scene]);

    useFrame(state => {
        const group = groupRef.current;
        if (!group || !animate) return;
        const t = state.clock.getElapsedTime();
        const { pointer } = state;

        // Slow turntable plus a gentle parallax that follows the pointer.
        const targetRotY = t * 0.12 + pointer.x * 0.5;
        const targetRotX = pointer.y * 0.25;
        group.rotation.y += (targetRotY - group.rotation.y) * 0.05;
        group.rotation.x += (targetRotX - group.rotation.x) * 0.05;
        group.position.x += (REST_X + pointer.x * 0.25 - group.position.x) * 0.05;
        group.position.y += (-1.1 + pointer.y * 0.15 - group.position.y) * 0.05;
    });

    return (
        <Float speed={animate ? 1.6 : 0} rotationIntensity={0.15} floatIntensity={0.4} floatingRange={[-0.3, 0.3]}>
            <group ref={groupRef} scale={2} position={[REST_X, -1.1, 0]} rotation={[0, -0.6, 0]}>
                <primitive object={king} />
            </group>
        </Float>
    );
};

/**
 * Decorative brass king floating behind the page. The canvas is transparent so
 * the page background (and theme transitions) come from CSS, and lighting is
 * generated locally (no HDR downloads from third-party CDNs).
 */
const Background3D = () => {
    const reducedMotion = usePrefersReducedMotion();
    // Rendered on the server too (client:media): WebGL only exists in the browser.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return (
        <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
            <Canvas
                camera={{ position: [0, 0, 6], fov: 40 }}
                dpr={[1, 1.5]}
                gl={{ alpha: true, antialias: true }}
                frameloop={reducedMotion ? 'demand' : 'always'}
                eventSource={document.body}
                eventPrefix="client"
            >
                <ambientLight intensity={0.9} />
                <spotLight position={[6, 8, 6]} angle={0.5} penumbra={1} intensity={90} color="#ffe2b0" />
                <pointLight position={[-6, -4, -4]} intensity={20} color="#3f7a63" />
                <KingModel animate={!reducedMotion} />
                <Environment resolution={128}>
                    <Lightformer form="rect" intensity={2} position={[0, 4, -6]} scale={[10, 3, 1]} color="#fff4e0" />
                    <Lightformer form="rect" intensity={1} position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} color="#cfe3d8" />
                    <Lightformer form="ring" intensity={1.5} position={[5, 2, 3]} scale={3} color="#ffd9a0" />
                </Environment>
            </Canvas>
        </div>
    );
};

useGLTF.preload('/king.glb');

export default Background3D;
