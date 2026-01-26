import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@nanostores/react';
import { themeStore } from '../store/theme';

const KingModel = ({ isDark }: { isDark: boolean }) => {
    const meshRef = useRef<THREE.Group>(null);
    // Preload asset
    const { scene } = useGLTF('/king.glb');

    // Clone scene and apply material based on theme
    const clone = React.useMemo(() => {
        const c = scene.clone();
        c.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                // We can just use one material and animate its color, but standard replacement is safer
                // We'll update the material ref in useFrame or effect if we want smooth transition, 
                // but rebuilding material on prop change is okay for now. 
                // To be smooth, we should simply update color prop.
                mesh.material = new THREE.MeshStandardMaterial({
                    color: '#fcd34d', // Base Gold
                    roughness: 0.1,
                    metalness: 0.8,
                });
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        return c;
    }, [scene]);

    useFrame((state) => {
        if (meshRef.current) {
            const t = state.clock.getElapsedTime();

            // Gentle floating rotation
            meshRef.current.rotation.y = Math.sin(t / 8) * 0.5 + t * 0.1;
            meshRef.current.rotation.x = Math.cos(t / 10) * 0.1;

            // Mouse Parallax (Using pointer for better support)
            const { pointer } = state;
            // Interpolate for smoothness
            // x/y are normalized (-1 to 1)
            meshRef.current.rotation.x += (pointer.y * 1.2 - meshRef.current.rotation.x) * 0.05;
            meshRef.current.rotation.y += (pointer.x * 1.2 - meshRef.current.rotation.y) * 0.05;

            // Positional parallax
            meshRef.current.position.x = pointer.x * 0.8;
            meshRef.current.position.y = -1 + pointer.y * 0.5;
        }
    });

    return (
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5} floatingRange={[-0.4, 0.4]}>
            <group ref={meshRef} dispose={null} scale={2} position={[0, -1, 0]}>
                <primitive object={clone} />
            </group>
        </Float>
    );
};

// Component to handle smooth background color transitions
const BackgroundColor = ({ isDark }: { isDark: boolean }) => {
    const color = useRef(new THREE.Color(isDark ? '#0c0a09' : '#e7e5e4')); // stone-950 vs stone-200

    useFrame((state, delta) => {
        const target = new THREE.Color(isDark ? '#0c0a09' : '#e7e5e4');
        // Smoothly interpolate
        color.current.lerp(target, delta * 2);
        state.scene.background = color.current;

        // Also update fog if attached
        if (state.scene.fog) {
            // @ts-ignore
            state.scene.fog.color.lerp(target, delta * 2);
        }
    });

    return <fog attach="fog" args={[isDark ? '#0c0a09' : '#e7e5e4', 5, 20]} />;
}

const Background3D = () => {
    const theme = useStore(themeStore);
    const isDark = theme === 'dark';

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="fixed inset-0 bg-stone-950 -z-10" />;

    return (
        <div className="fixed inset-0 -z-10 bg-stone-950">
            <Canvas camera={{ position: [0, 0, 6], fov: 40 }} shadows dpr={[1, 2]} eventSource={document.body} eventPrefix="client">
                <BackgroundColor isDark={isDark} />
                <ambientLight intensity={isDark ? 0.5 : 0.8} />
                <spotLight position={[10, 10, 10]} angle={0.5} penumbra={1} intensity={2} castShadow color="#fbbf24" />
                <pointLight position={[-10, -10, -10]} intensity={isDark ? 1 : 0.5} color="#3b82f6" />

                <KingModel isDark={isDark} />

                {isDark && <Stars radius={50} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />}
                <Environment preset={isDark ? "city" : "studio"} />
            </Canvas>
        </div>
    );
};

export default Background3D;
