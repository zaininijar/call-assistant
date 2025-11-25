import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { ConnectionState } from '../types';

interface SceneProps {
  connectionState: ConnectionState;
  inputAnalyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
}

const Scene: React.FC<SceneProps> = ({ connectionState, inputAnalyser, outputAnalyser }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- SETUP ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.02);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // --- LIGHTS ---
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00f3ff, 2, 50);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
    
    const pointLight2 = new THREE.PointLight(0xbc13fe, 2, 50);
    pointLight2.position.set(-5, -5, 5);
    scene.add(pointLight2);

    // --- GEOMETRY (The Core Sphere) ---
    // High detail Icosahedron for the "Neural Core"
    const geometry = new THREE.IcosahedronGeometry(1.8, 30);
    
    // Shader material for a glowing, electric look
    const material = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.1,
      metalness: 0.8,
      wireframe: true,
      emissive: 0x000000,
    });

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Inner Glow Sphere
    const innerGeo = new THREE.IcosahedronGeometry(1.4, 2);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerSphere);

    // Particles
    const particlesGeo = new THREE.BufferGeometry();
    const particlesCount = 800;
    const posArray = new Float32Array(particlesCount * 3);
    for(let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 15;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMat = new THREE.PointsMaterial({
        size: 0.02,
        color: 0xffffff,
        transparent: true,
        opacity: 0.5
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);


    // --- ANIMATION VARIABLES ---
    const originalPositions = geometry.attributes.position.array.slice(); // Copy original positions
    const clock = new THREE.Clock();
    let dataArrayInput: Uint8Array | null = null;
    let dataArrayOutput: Uint8Array | null = null;

    if (inputAnalyser) {
        dataArrayInput = new Uint8Array(inputAnalyser.frequencyBinCount);
    }
    if (outputAnalyser) {
        dataArrayOutput = new Uint8Array(outputAnalyser.frequencyBinCount);
    }

    // --- RESIZE HANDLER ---
    const handleResize = () => {
      if (!mountRef.current) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // --- ANIMATION LOOP ---
    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Audio Reactivity logic
      let loudnessInput = 0;
      let loudnessOutput = 0;

      // Update Analysers
      if (inputAnalyser && dataArrayInput) {
        inputAnalyser.getByteFrequencyData(dataArrayInput);
        const sum = dataArrayInput.reduce((a, b) => a + b, 0);
        loudnessInput = sum / dataArrayInput.length; 
      }
      
      if (outputAnalyser && dataArrayOutput) {
        outputAnalyser.getByteFrequencyData(dataArrayOutput);
        const sum = dataArrayOutput.reduce((a, b) => a + b, 0);
        loudnessOutput = sum / dataArrayOutput.length;
      }

      // Normalize loudness (0 to 1 range roughly)
      const inputNorm = loudnessInput / 255;
      const outputNorm = loudnessOutput / 255;
      
      const combinedActivity = Math.max(inputNorm, outputNorm);

      // Sphere Distortion
      // We manipulate vertices based on noise and audio level
      const positions = geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < positions.length; i += 3) {
        // Original vertex vector
        const x = originalPositions[i];
        const y = originalPositions[i + 1];
        const z = originalPositions[i + 2];
        const vector = new THREE.Vector3(x, y, z);
        
        // Base pulsation (breathing)
        const breathe = 1 + Math.sin(time * 1.5) * 0.02;

        // Audio distortion
        // Stronger distortion when talking (output) or listening (input)
        const distortion = Math.sin(vector.length() * 5 + time * 3) * (combinedActivity * 0.4);
        
        // Perlin-ish noise effect (simulated with sin/cos)
        const noise = Math.sin(x * 5 + time) * Math.cos(y * 5 + time) * (combinedActivity * 0.2);

        vector.multiplyScalar(breathe + distortion + noise);
        
        positions[i] = vector.x;
        positions[i + 1] = vector.y;
        positions[i + 2] = vector.z;
      }
      geometry.attributes.position.needsUpdate = true;

      // Color Dynamics
      // Blue = Idle/Listening (Input), Purple/Red = Speaking (Output)
      // Interpolate color based on output volume
      const baseColor = new THREE.Color(0x00f3ff); // Cyan
      const activeColor = new THREE.Color(0xbc13fe); // Purple
      
      // If connected but silent, slow rotation. If talking, fast rotation.
      const rotationSpeed = 0.2 + (combinedActivity * 2);
      sphere.rotation.y += rotationSpeed * 0.01;
      sphere.rotation.z += rotationSpeed * 0.005;
      innerSphere.rotation.x -= rotationSpeed * 0.01;
      particles.rotation.y += 0.002;

      if (connectionState === ConnectionState.CONNECTED) {
          // Lerp color towards purple when AI talks
          sphere.material.emissive.lerp(outputNorm > 0.1 ? activeColor : baseColor, 0.1);
          // Increase emissive intensity based on volume
          sphere.material.emissiveIntensity = 0.2 + combinedActivity * 1.5;
          innerSphere.material.color.lerp(outputNorm > 0.1 ? activeColor : baseColor, 0.1);
      } else {
          // Disconnected / Idle state
          sphere.material.emissive.setHex(0x111111);
          sphere.material.emissiveIntensity = 0.1;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [connectionState, inputAnalyser, outputAnalyser]);

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
};

export default Scene;