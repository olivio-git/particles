"use client";

import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

export default function FractalUniverse() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosition = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef<number>(0);
  // Expanded mode options
  const [mode, setMode] = useState<string>("cosmic"); // 'cosmic', 'fractal', 'vortex', 'neural', 'fluid', 'biological', 'weather'
  const [interactionMode, setInteractionMode] = useState<string>("attract"); // 'attract', 'repel', 'wave', 'voice', 'gesture'
  const [paused, setPaused] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(true);
  const particles = useRef<THREE.Points | null>(null);
  const particleData = useRef<{
    velocities: THREE.Vector3[];
    origPositions: THREE.Vector3[];
  }>({
    velocities: [],
    origPositions: [],
  });
  const time = useRef<number>(0);

  // Audio analysis refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [audioSource, setAudioSource] = useState<string>("mic"); // 'mic' or 'file'
  const audioIntensityRef = useRef<number>(0);

  // Video capture for gesture control
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const [gestureEnabled, setGestureEnabled] = useState<boolean>(false);
  const gesturePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const gestureIntensityRef = useRef<number>(0);

  // Capture/Export functionality
  const [captureMode, setCaptureMode] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  // const [audioSource, setAudioSource] = useState<string>("system"); // 'mic', 'file', 'system'
  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.01);

    // Camera setup with better perspective for 3D effect
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 20;
    camera.position.y = 5;
    camera.lookAt(0, 0, 0);

    // Renderer with higher quality settings
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true, // Enable for screenshots
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // Post-processing for advanced visual effects
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Custom bloom effect with better parameters
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.0, // strength
      0.4, // radius
      0.85 // threshold
    );
    composer.addPass(bloomPass);

    // Custom shader for color grading
    const colorShader = {
      uniforms: {
        tDiffuse: { value: null },
        intensity: { value: 0.5 },
        time: { value: 0 },
        audioIntensity: { value: 0 }, // New uniform for audio reactivity
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float intensity;
        uniform float time;
        uniform float audioIntensity;
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        
        vec3 colorGrade(vec3 color, float t, float audio) {
          // Enhanced color grading with audio reactivity
          float r = color.r * (1.0 + 0.1 * sin(time * 0.1) + audio * 0.2);
          float g = color.g * (1.0 + 0.1 * cos(time * 0.13) + audio * 0.15);
          float b = color.b * (1.0 + 0.1 * sin(time * 0.17) + audio * 0.25);
          
          // Add subtle color shift influenced by audio
          return vec3(
            r + 0.02 * sin(time * 0.5 + audio),
            g + 0.02 * sin(time * 0.5 + 2.0 + audio * 0.7),
            b + 0.02 * sin(time * 0.5 + 4.0 + audio * 1.3)
          );
        }
        
        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 graded = colorGrade(texel.rgb, time, audioIntensity);
          
          // Add audio pulse effect to brightness
          float brightness = 1.0 + audioIntensity * 0.2;
          gl_FragColor = vec4(graded * brightness, texel.a);
        }
      `,
    };

    const colorPass = new ShaderPass(colorShader);
    composer.addPass(colorPass);

    // Particle system configurations for different modes
    const modeConfigs = {
      cosmic: {
        count: 20000,
        size: 0.03,
        speed: 0.2,
        colors: [
          new THREE.Color(0x0b66ff), // blue
          new THREE.Color(0xff00ff), // magenta
          new THREE.Color(0x00ffff), // cyan
        ],
        distribution: "sphere",
      },
      fractal: {
        count: 15000,
        size: 0.04,
        speed: 0.3,
        colors: [
          new THREE.Color(0x00ff00), // green
          new THREE.Color(0xffff00), // yellow
          new THREE.Color(0xff6600), // orange
        ],
        distribution: "mandelbulb",
      },
      vortex: {
        count: 25000,
        size: 0.02,
        speed: 0.5,
        colors: [
          new THREE.Color(0xff0000), // red
          new THREE.Color(0xff6600), // orange
          new THREE.Color(0xffcc00), // amber
        ],
        distribution: "spiral",
      },
      neural: {
        count: 30000,
        size: 0.015,
        speed: 0.15,
        colors: [
          new THREE.Color(0x6600ff), // purple
          new THREE.Color(0x0066ff), // blue
          new THREE.Color(0x00ffcc), // teal
        ],
        distribution: "network",
      },
      // NEW MODE: Fluid simulation inspired by Navier-Stokes
      fluid: {
        count: 35000,
        size: 0.02,
        speed: 0.4,
        colors: [
          new THREE.Color(0x0044ff), // deep blue
          new THREE.Color(0x00ccff), // light blue
          new THREE.Color(0x00ffcc), // teal
        ],
        distribution: "fluid",
      },
      // NEW MODE: Biological cell simulation
      biological: {
        count: 25000,
        size: 0.025,
        speed: 0.2,
        colors: [
          new THREE.Color(0x00cc44), // green
          new THREE.Color(0x44ff88), // light green
          new THREE.Color(0xffcc44), // amber
        ],
        distribution: "cellular",
      },
      // NEW MODE: Weather/climate data visualization
      weather: {
        count: 30000,
        size: 0.03,
        speed: 0.35,
        colors: [
          new THREE.Color(0x0088ff), // blue (cold)
          new THREE.Color(0xffffff), // white (neutral)
          new THREE.Color(0xff4400), // red (hot)
        ],
        distribution: "atmospheric",
      },
    };

    // Create the particle system
    const createParticleSystem = () => {
      // Remove existing particles if any
      if (particles.current) {
        scene.remove(particles.current);
        particles.current = null;
      }

      const config = modeConfigs[mode as keyof typeof modeConfigs];
      const particlesCount = config.count;
      const particlesGeometry = new THREE.BufferGeometry();

      // Position and color arrays
      const posArray = new Float32Array(particlesCount * 3);
      const colorArray = new Float32Array(particlesCount * 3);

      // Clear previous particle data
      particleData.current.velocities = [];
      particleData.current.origPositions = [];

      // Generate positions based on distribution
      for (let i = 0; i < particlesCount; i++) {
        let x, y, z, colorIndex;

        switch (config.distribution) {
          case "mandelbulb":
            // Fractal-like distribution (simplified Mandelbulb)
            const t = Math.random() * Math.PI * 2;
            const p = Math.random() * Math.PI;
            const r = 5 + 3 * Math.sin(8 * p) * Math.sin(8 * t);

            x = r * Math.sin(p) * Math.cos(t);
            y = r * Math.sin(p) * Math.sin(t);
            z = r * Math.cos(p);

            // Color based on position
            colorIndex = Math.abs(Math.sin(p * 10 + t * 5));
            break;

          case "spiral":
            // Spiral galaxy-like distribution
            const arms = 3;
            const spiralT = Math.random() * Math.PI * 15;
            const spiralR = 12 * Math.random();
            const armOffset =
              (Math.floor(Math.random() * arms) * Math.PI * 2) / arms;

            x = spiralR * Math.cos(spiralT + armOffset + spiralR * 0.2);
            y = spiralR * Math.sin(spiralT + armOffset + spiralR * 0.2);
            z = (Math.random() - 0.5) * 2;

            // Particles closer to center are different color
            colorIndex = spiralR / 12;
            break;

          case "network":
            // Neural network-like structure
            // Generate clusters with connections
            const clusters = 12;
            const clusterIndex = Math.floor(Math.random() * clusters);
            const clusterSize = 2;
            const clusterPos = new THREE.Vector3(
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 20
            );

            // Make nodes (dense areas) and connections (sparse areas)
            if (Math.random() > 0.7) {
              // Node particle
              x = clusterPos.x + (Math.random() - 0.5) * clusterSize;
              y = clusterPos.y + (Math.random() - 0.5) * clusterSize;
              z = clusterPos.z + (Math.random() - 0.5) * clusterSize;
            } else {
              // Connection particle
              const connectionT = Math.random();
              // const otherClusterIndex =
              //   (clusterIndex +
              //     1 +
              //     Math.floor(Math.random() * (clusters - 1))) %
              //   clusters;
              const otherClusterPos = new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
              );

              x =
                clusterPos.x * (1 - connectionT) +
                otherClusterPos.x * connectionT;
              y =
                clusterPos.y * (1 - connectionT) +
                otherClusterPos.y * connectionT;
              z =
                clusterPos.z * (1 - connectionT) +
                otherClusterPos.z * connectionT;
            }

            // Color based on position
            colorIndex = Math.abs(clusterIndex / clusters);
            break;

          // NEW DISTRIBUTION: Fluid simulation
          case "fluid":
            // Create flow lines and vortices
            if (Math.random() > 0.7) {
              // Create vortex centers
              const vortexCenter = new THREE.Vector3(
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15
              );

              // Particles around vortices
              const vortexRadius = 2 + Math.random() * 3;
              const vortexAngle = Math.random() * Math.PI * 2;
              const vortexHeight = (Math.random() - 0.5) * 4;

              x = vortexCenter.x + Math.cos(vortexAngle) * vortexRadius;
              y = vortexCenter.y + vortexHeight;
              z = vortexCenter.z + Math.sin(vortexAngle) * vortexRadius;
            } else {
              // Flow lines
              const flowLine = Math.floor(Math.random() * 10);
              // const flowT = Math.random();

              // Create slightly curved flow lines
              x = (Math.random() - 0.5) * 30;
              y = Math.sin(x * 0.2) * 3 + flowLine - 5;
              z = Math.cos(x * 0.3) * 2 + flowLine - 5;
            }

            // Color based on y-position (height in fluid)
            colorIndex = (y + 10) / 20;
            break;

          // NEW DISTRIBUTION: Biological cells
          case "cellular":
            if (Math.random() > 0.6) {
              // Cell nucleus
              const cellCenter = new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
              );

              // Dense nucleus
              x = cellCenter.x + (Math.random() - 0.5) * 2;
              y = cellCenter.y + (Math.random() - 0.5) * 2;
              z = cellCenter.z + (Math.random() - 0.5) * 2;

              colorIndex = 0.8 + Math.random() * 0.2; // More orange/yellow
            } else if (Math.random() > 0.4) {
              // Cell membrane
              const phi = Math.random() * Math.PI * 2;
              const theta = Math.random() * Math.PI;
              const radius = 4 + (Math.random() - 0.5) * 0.5;

              const cellCenter = new THREE.Vector3(
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15
              );

              x = cellCenter.x + radius * Math.sin(theta) * Math.cos(phi);
              y = cellCenter.y + radius * Math.sin(theta) * Math.sin(phi);
              z = cellCenter.z + radius * Math.cos(theta);

              colorIndex = 0.4 + Math.random() * 0.2; // Mid-range green
            } else {
              // Cellular fluid / organelles
              const cellCenter = new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
              );

              const dist = 2 + Math.random() * 2.5;
              const angle1 = Math.random() * Math.PI * 2;
              const angle2 = Math.random() * Math.PI * 2;

              x = cellCenter.x + Math.cos(angle1) * Math.sin(angle2) * dist;
              y = cellCenter.y + Math.sin(angle1) * Math.sin(angle2) * dist;
              z = cellCenter.z + Math.cos(angle2) * dist;

              colorIndex = Math.random() * 0.3; // More green
            }
            break;

          // NEW DISTRIBUTION: Weather patterns / atmospheric
          case "atmospheric":
            if (Math.random() > 0.7) {
              // Cloud formations
              const cloudBase = -5 + Math.random() * 10;
              const cloudSize = 2 + Math.random() * 4;

              x = (Math.random() - 0.5) * 30;
              y = cloudBase + Math.random() * cloudSize;
              z = (Math.random() - 0.5) * 30;

              colorIndex = 0.4 + Math.random() * 0.2; // White/neutral
            } else if (Math.random() > 0.4) {
              // Air currents / wind patterns
              const windLayer = Math.floor(Math.random() * 5) - 2;
              // const flowStrength = 15;

              x = (Math.random() - 0.5) * 30;
              z = (Math.random() - 0.5) * 30;
              y = windLayer * 3 + Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;

              // Color based on height (temperature)
              colorIndex = (y + 10) / 20; // Blue (low/cold) to red (high/hot)
            } else {
              // Precipitation / storm systems
              if (Math.random() > 0.5) {
                // Rain
                x = (Math.random() - 0.5) * 30;
                z = (Math.random() - 0.5) * 30;
                y = 5 - Math.random() * 15; // Falling from sky
                colorIndex = 0.2; // Blue
              } else {
                // Storm systems
                const stormCenter = new THREE.Vector3(
                  (Math.random() - 0.5) * 20,
                  0,
                  (Math.random() - 0.5) * 20
                );

                const radius = 3 + Math.random() * 7;
                const angle = Math.random() * Math.PI * 2;
                const height = Math.random() * 6;

                x = stormCenter.x + Math.cos(angle) * radius;
                z = stormCenter.z + Math.sin(angle) * radius;
                y = height - 3;

                colorIndex = 0.3 + Math.random() * 0.4;
              }
            }
            break;

          case "sphere":
          default:
            // Enhanced sphere distribution with clumping
            if (Math.random() > 0.8) {
              // Create dense clusters
              const clusterCenter = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
              )
                .normalize()
                .multiplyScalar(5 + Math.random() * 3);

              x = clusterCenter.x + (Math.random() - 0.5) * 2;
              y = clusterCenter.y + (Math.random() - 0.5) * 2;
              z = clusterCenter.z + (Math.random() - 0.5) * 2;
            } else {
              // Regular sphere distribution
              const r = 5 + Math.random() * 8;
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.random() * Math.PI;

              x = r * Math.sin(phi) * Math.cos(theta);
              y = r * Math.sin(phi) * Math.sin(theta);
              z = r * Math.cos(phi);
            }

            // Color based on distance from center
            const distance = Math.sqrt(x * x + y * y + z * z);
            colorIndex = distance / 13;
            break;
        }

        // Set position
        const index = i * 3;
        posArray[index] = x;
        posArray[index + 1] = y;
        posArray[index + 2] = z;

        // Store original position for animations
        particleData.current.origPositions.push(new THREE.Vector3(x, y, z));

        // Initial velocity (will be used for physics)
        particleData.current.velocities.push(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.01
          )
        );

        // Set color based on gradient
        const colorMix = Math.max(0, Math.min(1, colorIndex));

        // Pick a color based on the colorMix
        let col1, col2;
        if (colorMix < 0.5) {
          col1 = config.colors[0];
          col2 = config.colors[1];
          const adjustedMix = colorMix * 2; // Scale 0-0.5 to 0-1
          const mixedColor = col1.clone().lerp(col2, adjustedMix);
          colorArray[index] = mixedColor.r;
          colorArray[index + 1] = mixedColor.g;
          colorArray[index + 2] = mixedColor.b;
        } else {
          col1 = config.colors[1];
          col2 = config.colors[2];
          const adjustedMix = (colorMix - 0.5) * 2; // Scale 0.5-1 to 0-1
          const mixedColor = col1.clone().lerp(col2, adjustedMix);
          colorArray[index] = mixedColor.r;
          colorArray[index + 1] = mixedColor.g;
          colorArray[index + 2] = mixedColor.b;
        }
      }

      particlesGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(posArray, 3)
      );
      particlesGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(colorArray, 3)
      );

      // Particle material with higher quality settings
      const particlesMaterial = new THREE.PointsMaterial({
        size: config.size,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        depthWrite: false,
      });

      // Create particles and add to scene
      particles.current = new THREE.Points(
        particlesGeometry,
        particlesMaterial
      );
      scene.add(particles.current);
    };

    createParticleSystem();

    // Add atmospheric lighting
    const ambientLight = new THREE.AmbientLight(0x111111);
    scene.add(ambientLight);

    // Add directional lights for depth
    const directionalLight1 = new THREE.DirectionalLight(0x3366ff, 0.5);
    directionalLight1.position.set(1, 1, 1);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xff6633, 0.3);
    directionalLight2.position.set(-1, -1, -1);
    scene.add(directionalLight2);

    // Add point lights that move
    const pointLight1 = new THREE.PointLight(0xff9000, 2, 50);
    pointLight1.position.set(0, 0, 0);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x0066ff, 2, 50);
    pointLight2.position.set(0, 0, 0);
    scene.add(pointLight2);

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    // Handle mouse movement
    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1,
      };
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Handle touch movement
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        mousePosition.current = {
          x: (event.touches[0].clientX / window.innerWidth) * 2 - 1,
          y: -(event.touches[0].clientY / window.innerHeight) * 2 + 1,
        };
      }
    };

    window.addEventListener("touchmove", handleTouchMove);

    // Handle key presses with expanded options
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "m":
          // Cycle through expanded visualization modes
          setMode((prev) => {
            if (prev === "cosmic") return "fractal";
            if (prev === "fractal") return "vortex";
            if (prev === "vortex") return "neural";
            if (prev === "neural") return "fluid";
            if (prev === "fluid") return "biological";
            if (prev === "biological") return "weather";
            return "cosmic";
          });
          break;
        case "i":
          // Toggle interaction mode (expanded)
          setInteractionMode((prev) => {
            if (prev === "attract") return "repel";
            if (prev === "repel") return "wave";
            if (prev === "wave") return "voice";
            if (prev === "voice") return "gesture";
            return "attract";
          });
          break;
        case " ": // Space bar
          // Pause/resume the animation
          setPaused((prev) => !prev);
          break;
        case "h":
          // Toggle info display
          setShowInfo((prev) => !prev);
          break;
        case "a":
          // Toggle audio reactivity
          toggleAudioReactivity();
          break;
        case "g":
          // Toggle gesture control
          toggleGestureControl();
          break;
        case "c":
          // Toggle capture mode
          setCaptureMode((prev) => !prev);
          break;
        case "r":
          // Start/stop recording
          if (!isRecording) {
            startRecording();
          } else {
            stopRecording();
          }
          break;
        case "s":
          // Take screenshot
          takeScreenshot();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Toggle audio reactivity
    const toggleAudioReactivity = () => {
      if (!audioEnabled) {
        setupAudioAnalysis(audioSource);
      } else {
        cleanupAudioContext();
        setAudioEnabled(false);
      }
    };

    // Audio analysis function - called each frame when audio is enabled
    const analyzeAudio = () => {
      if (!audioEnabled || !audioAnalyserRef.current || !audioDataRef.current)
        return 0;

      audioAnalyserRef.current.getByteFrequencyData(audioDataRef.current);

      // Calculate audio intensity (average of frequency data)
      let sum = 0;
      for (let i = 0; i < audioDataRef.current.length; i++) {
        sum += audioDataRef.current[i];
      }

      const average = sum / audioDataRef.current.length;
      const normalized = average / 255; // 0-1 range

      // Smooth the intensity over time for more natural animation
      audioIntensityRef.current =
        audioIntensityRef.current * 0.85 + normalized * 0.15;

      return audioIntensityRef.current;
    };

    // Set up video capture for gesture interaction
    const setupGestureRecognition = async () => {
      try {
        if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        // Create video element if needed
        if (!videoRef.current) {
          videoRef.current = document.createElement("video");
          videoRef.current.style.position = "absolute";
          videoRef.current.style.right = "10px";
          videoRef.current.style.bottom = "10px";
          videoRef.current.style.width = "160px";
          videoRef.current.style.height = "120px";
          videoRef.current.style.opacity = "0.5";
          videoRef.current.style.zIndex = "100";
          videoRef.current.style.transform = "scaleX(-1)"; // Mirror effect
          document.body.appendChild(videoRef.current);
        }

        // Get camera stream
        videoStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
        });

        videoRef.current.srcObject = videoStreamRef.current;
        videoRef.current.play();

        setGestureEnabled(true);
      } catch (error) {
        console.error("Error accessing camera:", error);
        setGestureEnabled(false);
      }
    };

    // Clean up video resources
    const cleanupVideoResources = () => {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (videoRef.current && videoRef.current.parentNode) {
        videoRef.current.parentNode.removeChild(videoRef.current);
        videoRef.current = null;
      }

      videoStreamRef.current = null;
      setGestureEnabled(false);
    };

    // Toggle gesture control
    const toggleGestureControl = () => {
      if (!gestureEnabled) {
        setupGestureRecognition();
      } else {
        cleanupVideoResources();
      }
    };

    // Process gesture from video - basic motion detection
    const processGestures = () => {
      if (!gestureEnabled || !videoRef.current) return;

      // Create canvas to process video frames
      const canvas = document.createElement("canvas");
      canvas.width = 80; // Low res for performance
      canvas.height = 60;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      // Draw current video frame to canvas
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      // Get frame data
      const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = frameData.data;

      // Find the "hottest" pixel (simple gesture detection)
      let maxBrightness = 0;
      let maxX = canvas.width / 2;
      let maxY = canvas.height / 2;

      // Sample pixels for motion (not every pixel, for performance)
      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          const i = (y * canvas.width + x) * 4;
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;

          if (brightness > maxBrightness) {
            maxBrightness = brightness;
            maxX = x;
            maxY = y;
          }
        }
      }

      // Normalize coordinates (-1 to 1)
      gesturePositionRef.current = {
        x: (maxX / canvas.width) * 2 - 1,
        y: (maxY / canvas.height) * 2 - 1,
      };

      // Use brightness as intensity
      gestureIntensityRef.current = maxBrightness / 255;
    };

    // Physics and interaction functions
    const applyPhysics = (deltaTime: number) => {
      if (!particles.current || paused) return;

      const positions = particles.current.geometry.attributes.position
        .array as Float32Array;
      const config = modeConfigs[mode as keyof typeof modeConfigs];

      // Create an interaction vector based on the active interaction mode
      let interactionVector: THREE.Vector3;
      let interactionRadius = 10;
      let interactionStrength = 0.05;

      // Determine interaction source based on mode
      if (interactionMode === "gesture" && gestureEnabled) {
        interactionVector = new THREE.Vector3(
          gesturePositionRef.current.x * 10,
          gesturePositionRef.current.y * 10,
          0
        );
        interactionStrength *= gestureIntensityRef.current * 2;
      } else {
        // Default to mouse control
        interactionVector = new THREE.Vector3(
          mousePosition.current.x * 10,
          mousePosition.current.y * 10,
          0
        );
      }

      // Get audio intensity for physics if enabled
      const audioIntensity = audioEnabled ? analyzeAudio() : 0;

      // Update color pass uniform with audio data
      if (colorPass) {
        colorPass.uniforms.audioIntensity.value = audioIntensity;
      }

      // Apply audio influence to particle system scale
      if (particles.current && audioEnabled) {
        const baseSize = config.size;
        const sizePulse = baseSize * (1 + audioIntensity * 0.5);
        (particles.current.material as THREE.PointsMaterial).size = sizePulse;
      }

      for (let i = 0; i < particleData.current.velocities.length; i++) {
        const idx = i * 3;
        const particle = new THREE.Vector3(
          positions[idx],
          positions[idx + 1],
          positions[idx + 2]
        );

        const velocity = particleData.current.velocities[i];
        const originalPos = particleData.current.origPositions[i];

        // Apply various forces based on the interaction mode

        // Force 1: Return to original position (spring force)
        const toOrigin = originalPos.clone().sub(particle);
        const springForce = toOrigin.multiplyScalar(0.001);
        velocity.add(springForce);

        // Force 2: Interaction (mouse/gesture)
        const toInteraction = interactionVector.clone().sub(particle);
        const distanceToInteraction = toInteraction.length();

        if (distanceToInteraction < interactionRadius) {
          const force = toInteraction.normalize();

          switch (interactionMode) {
            case "attract":
            case "gesture": // Gesture defaults to attract
              force.multiplyScalar(
                interactionStrength *
                  (1 - distanceToInteraction / interactionRadius)
              );
              break;
            case "repel":
              force.multiplyScalar(
                -interactionStrength *
                  (1 - distanceToInteraction / interactionRadius)
              );
              break;
            case "wave":
              // Create a wave effect emanating from the interaction point
              const wavePhase = time.current * 3 - distanceToInteraction * 0.5;
              const waveAmplitude =
                interactionStrength *
                (1 - distanceToInteraction / interactionRadius);
              force.multiplyScalar(Math.sin(wavePhase) * waveAmplitude);
              break;
            case "voice":
              // Voice interaction uses audio intensity to affect particle movement
              if (audioEnabled) {
                const voiceStrength = interactionStrength * audioIntensity * 3;
                force.multiplyScalar(
                  voiceStrength *
                    (1 - distanceToInteraction / interactionRadius)
                );
              }
              break;
          }

          velocity.add(force);
        }

        // Force 3: Mode-specific behavior
        switch (mode) {
          case "vortex":
            // Add a swirling force
            const perpendicular = new THREE.Vector3(
              -particle.z,
              0,
              particle.x
            ).normalize();
            perpendicular.multiplyScalar(0.01);
            velocity.add(perpendicular);
            break;
          case "fractal":
            // Add a pulsing expansion/contraction
            const pulseForce = particle.clone().normalize();
            const pulseFactor = Math.sin(time.current) * 0.005;
            pulseForce.multiplyScalar(pulseFactor * (1 + audioIntensity * 2));
            velocity.add(pulseForce);
            break;
          case "neural":
            // Add a jittering effect
            velocity.add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01
              )
            );
            break;
          case "fluid":
            // Add fluid dynamics effects
            // Simplified Navier-Stokes influence
            const fluidVelocity = new THREE.Vector3(
              Math.sin(particle.y * 0.1 + time.current) * 0.01,
              Math.cos(particle.x * 0.1 + time.current) * 0.01,
              Math.sin(particle.x * 0.1 + particle.y * 0.1 + time.current) *
                0.01
            );

            // Add vorticity
            const vortex = new THREE.Vector3(
              particle.y - Math.sin(time.current),
              -particle.x + Math.cos(time.current),
              Math.sin(particle.x + particle.y + time.current * 0.5)
            )
              .normalize()
              .multiplyScalar(0.003);

            velocity.add(fluidVelocity);
            velocity.add(vortex);

            // Audio affects turbulence
            if (audioEnabled) {
              const turbulence = new THREE.Vector3(
                (Math.random() - 0.5) * audioIntensity * 0.05,
                (Math.random() - 0.5) * audioIntensity * 0.05,
                (Math.random() - 0.5) * audioIntensity * 0.05
              );
              velocity.add(turbulence);
            }
            break;
          case "biological":
            // Cell-like behavior (pulsing and division)
            // Simulate cellular motion within membranes
            const cellCenter = originalPos.clone();
            const toCenter = cellCenter.clone().sub(particle);
            const distToCenter = toCenter.length();

            // Cells oscillate and move organically
            if (distToCenter > 3) {
              // Return to cell
              toCenter.normalize().multiplyScalar(0.01);
              velocity.add(toCenter);
            } else {
              // Internal movement - cytoplasmic streaming
              const brownian = new THREE.Vector3(
                Math.sin(particle.x * 2 + time.current) * 0.005,
                Math.cos(particle.y * 2 + time.current) * 0.005,
                Math.sin(particle.z * 2 + time.current) * 0.005
              );
              velocity.add(brownian);
            }

            // Cell division simulation - triggered by audio or time
            const divisionFactor = audioEnabled
              ? audioIntensity
              : Math.sin(time.current * 0.2) * 0.5 + 0.5;
            if (divisionFactor > 0.8 && Math.random() > 0.99) {
              const divisionDir = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
              )
                .normalize()
                .multiplyScalar(0.1);
              velocity.add(divisionDir);
            }
            break;
          case "weather":
            // Weather system behaviors
            // Height-based wind currents
            const height = particle.y + 5; // Normalize so 0 is ground level

            // Different wind patterns at different altitudes
            if (height < 3) {
              // Ground level
              velocity.add(
                new THREE.Vector3(
                  Math.sin(time.current * 0.2) * 0.002,
                  0,
                  Math.cos(time.current * 0.3) * 0.002
                )
              );
            } else if (height < 7) {
              // Mid atmosphere
              velocity.add(
                new THREE.Vector3(
                  Math.sin(time.current * 0.1 + particle.z * 0.1) * 0.01,
                  Math.sin(time.current * 0.2) * 0.001,
                  Math.cos(time.current * 0.1 + particle.x * 0.1) * 0.01
                )
              );
            } else {
              // Upper atmosphere
              velocity.add(
                new THREE.Vector3(
                  Math.cos(time.current * 0.3) * 0.02,
                  0,
                  Math.sin(time.current * 0.3) * 0.02
                )
              );
            }

            // Precipitation effect
            if (particle.y < -2 && Math.random() > 0.99) {
              // Respawn at top as new raindrops
              positions[idx + 1] = 8 + Math.random() * 4;
              // Reset velocity but keep horizontal component
              velocity.y = -0.05 - Math.random() * 0.1;
            }

            // Audio affects storm intensity
            if (audioEnabled) {
              const stormIntensity = audioIntensity * 0.1;
              velocity.add(
                new THREE.Vector3(
                  (Math.random() - 0.5) * stormIntensity,
                  (Math.random() - 0.5) * stormIntensity,
                  (Math.random() - 0.5) * stormIntensity
                )
              );
            }
            break;
        }

        // Apply velocity damping for stability
        velocity.multiplyScalar(0.98);

        // Update position with velocity
        particle.add(velocity.clone().multiplyScalar(deltaTime * config.speed));

        // Update particle positions in the buffer
        positions[idx] = particle.x;
        positions[idx + 1] = particle.y;
        positions[idx + 2] = particle.z;
      }

      // Mark the position attribute as needing an update
      particles.current.geometry.attributes.position.needsUpdate = true;
    };

    // Animation loop with expanded features
    let lastTime = 0;
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 16.67; // Normalize to ~60fps
      lastTime = currentTime;

      animationFrameId.current = requestAnimationFrame(animate);

      // Process gesture input if enabled
      if (gestureEnabled) {
        processGestures();
      }

      // Update time reference for shaders and animations
      time.current += 0.01 * (paused ? 0 : 1);

      // Update custom shader uniforms
      colorPass.uniforms.time.value = time.current;

      // Apply physics
      applyPhysics(deltaTime);

      // Camera movement for immersive effect (enhanced with audio reactivity)
      const cameraMovementFactor = audioEnabled
        ? 1 + audioIntensityRef.current
        : 1;

      camera.position.x =
        Math.sin(time.current * 0.1) * 5 * cameraMovementFactor;
      camera.position.y =
        Math.cos(time.current * 0.15) * 5 * cameraMovementFactor + 5;
      camera.lookAt(0, 0, 0);

      // Update moving lights (with audio-reactive intensity)
      const lightIntensity = audioEnabled
        ? 2 + audioIntensityRef.current * 3
        : 2;

      pointLight1.intensity = lightIntensity;
      pointLight1.position.x = Math.sin(time.current * 0.3) * 15;
      pointLight1.position.z = Math.cos(time.current * 0.3) * 15;

      pointLight2.intensity = lightIntensity * 0.7;
      pointLight2.position.x = Math.sin(time.current * 0.3 + Math.PI) * 15;
      pointLight2.position.z = Math.cos(time.current * 0.3 + Math.PI) * 15;

      // Mode-specific camera effects
      switch (mode) {
        case "fluid":
          // Flowing camera motion for fluid simulation
          camera.position.y = 5 + Math.sin(time.current * 0.2) * 3;
          camera.position.z = 20 + Math.sin(time.current * 0.1) * 5;
          break;
        case "biological":
          // Microscope-like camera movement
          camera.position.z = 15 + Math.sin(time.current * 0.05) * 3;
          camera.position.x = Math.sin(time.current * 0.07) * 3;
          break;
        case "weather":
          // Weather observation camera
          camera.position.y = 10 + Math.sin(time.current * 0.1) * 5;
          camera.position.z = 25 + Math.cos(time.current * 0.08) * 5;
          break;
      }

      // Render the scene with post-processing
      composer.render();
    };

    animate(0);

    // Effect cleanup
    return () => {
      cancelAnimationFrame(animationFrameId.current);
      cleanupAudioContext();
      cleanupVideoResources();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    mode,
    interactionMode,
    paused,
    audioEnabled,
    audioSource,
    gestureEnabled,
  ]);

  // Mode changing effect
  useEffect(() => {
    // Recreate particles when mode changes
    // The main effect will handle this since mode is in its dependencies
  }, [mode]);
  // Audio analysis functions
  const setupAudioAnalysis = async (sourceType: string) => {
    try {
      // Clean up existing audio if needed
      if (audioContextRef.current) {
        await cleanupAudioContext();
      }

      // Create audio context
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioAnalyserRef.current = audioContextRef.current.createAnalyser();
      audioAnalyserRef.current.fftSize = 256;

      const bufferLength = audioAnalyserRef.current.frequencyBinCount;
      audioDataRef.current = new Uint8Array(bufferLength);

      // Set up audio source based on type
      if (sourceType === "mic") {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const source = audioContextRef.current.createMediaStreamSource(
          mediaStreamRef.current
        );
        source.connect(audioAnalyserRef.current);
      } else if (sourceType === "system") {
        // Intento de capturar el audio del sistema
        try {
          // Esta es la parte clave - solicitar el audio del sistema
          // Nota: Esto solo funciona en Chrome con el flag experimental habilitado,
          // o en navegadores que implementen esta característica
          const constraints = {
            audio: {
              // Use standard constraints, not the deprecated mandatory object
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            },
            video: {
              width: 1, // Request minimal video to focus on audio
              height: 1
            }
          };

          // Intentar obtener el audio del sistema
          mediaStreamRef.current = await navigator.mediaDevices.getDisplayMedia(constraints);
          
          // Verificar si hay pistas de audio
          const audioTracks = mediaStreamRef.current.getAudioTracks();
          if (audioTracks.length === 0) {
            throw new Error("No se pudo capturar el audio del sistema");
          }
          
          console.log("Audio del sistema capturado correctamente");
          const source = audioContextRef.current.createMediaStreamSource(
            mediaStreamRef.current
          );
          source.connect(audioAnalyserRef.current);
        } catch (systemAudioError) {
          console.error("Error al capturar audio del sistema:", systemAudioError);
          console.log("Usando micrófono como alternativa para captar audio ambiental");
          
          // Fallback al micrófono si no se puede capturar el audio del sistema
          mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false, // Desactivar cancelación de eco
              noiseSuppression: false, // Desactivar supresión de ruido
              autoGainControl: false, // Desactivar control automático de ganancia
            }
          });
          
          const source = audioContextRef.current.createMediaStreamSource(
            mediaStreamRef.current
          );
          source.connect(audioAnalyserRef.current);
          
          // Mostrar aviso visual para el usuario
          showSystemAudioNotice();
        }
      } else {
        // File audio
        const audioEl = document.createElement("audio");
        audioEl.src = "/path/to/default/music.mp3"; // Update for user uploads
        audioEl.autoplay = true;
        audioEl.loop = true;
        document.body.appendChild(audioEl);

        const source =
          audioContextRef.current.createMediaElementSource(audioEl);
        source.connect(audioAnalyserRef.current);
        audioAnalyserRef.current.connect(audioContextRef.current.destination);
      }

      setAudioEnabled(true);
      setAudioSource(sourceType);
    } catch (error) {
      console.error("Error accessing audio:", error);
      setAudioEnabled(false);
    }
  };
  const showSystemAudioNotice = () => {
    const noticeDiv = document.createElement('div');
    noticeDiv.style.position = 'fixed';
    noticeDiv.style.top = '20px';
    noticeDiv.style.left = '50%';
    noticeDiv.style.transform = 'translateX(-50%)';
    noticeDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    noticeDiv.style.color = 'white';
    noticeDiv.style.padding = '15px 20px';
    noticeDiv.style.borderRadius = '8px';
    noticeDiv.style.zIndex = '1000';
    noticeDiv.style.maxWidth = '400px';
    noticeDiv.style.textAlign = 'center';
    noticeDiv.innerHTML = `
      <p style="margin: 0; font-weight: bold">Usando micrófono para captar audio ambiental</p>
      <p style="margin: 5px 0 0 0; font-size: 14px">Para mejores resultados, coloca el micrófono cerca de los altavoces o sube el volumen.</p>
    `;
    
    document.body.appendChild(noticeDiv);
    
    // Eliminar aviso después de 6 segundos
    setTimeout(() => {
      document.body.removeChild(noticeDiv);
    }, 6000);
  };
  const cleanupAudioContext = async () => {
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      await audioContextRef.current.close();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    audioContextRef.current = null;
    audioAnalyserRef.current = null;
    audioDataRef.current = null;
    mediaStreamRef.current = null;
  };
  // Screen capture functions
  const takeScreenshot = () => {
    if (!canvasRef.current) return;

    try {
      // Convert canvas to data URL
      const imageURL = canvasRef.current.toDataURL("image/png");

      // Create download link
      const link = document.createElement("a");
      link.href = imageURL;
      link.download = `fractal-universe-${mode}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log("Screenshot saved!");
    } catch (error) {
      console.error("Error taking screenshot:", error);
    }
  };

  // Stop video recording
  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
    }
  };
  // Start video recording
  const startRecording = () => {
    if (!canvasRef.current || isRecording) return;

    try {
      // Get media stream from canvas
      const stream = canvasRef.current.captureStream(30); // 30 FPS

      // Initialize media recorder
      recorderRef.current = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });

      // Set up recorder events
      recorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorderRef.current.onstop = () => {
        // Create blob from recorded chunks
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        recordedChunksRef.current = [];

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.style.display = "none";
        link.href = url;
        link.download = `fractal-universe-${mode}-${Date.now()}.webm`;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);

        setIsRecording(false);
        console.log("Recording saved!");
      };

      // Start recording
      recordedChunksRef.current = [];
      recorderRef.current.start();
      setIsRecording(true);
      console.log("Recording started...");
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
    }
  };

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 -z-10 w-full h-full" />

      {/* Expanded UI with new features */}
      {showInfo && (
        <div className="fixed bottom-4 left-4 text-white bg-black bg-opacity-70 p-4 rounded max-w-md">
          <h2 className="text-xl font-bold mb-2">
            Universo de Partículas Fractales
          </h2>
          <div className="mb-2">
            <p className="font-semibold">Modo: {mode}</p>
            <p className="font-semibold">Interacción: {interactionMode}</p>
            <p className="font-semibold">
              Estado: {paused ? "Pausado" : "Activo"}
            </p>
            <p className="font-semibold">
              Audio: {audioEnabled ? "Activado" : "Desactivado"}
            </p>
            <p className="font-semibold">
              Control gestual: {gestureEnabled ? "Activado" : "Desactivado"}
            </p>
            {isRecording && (
              <p className="font-semibold text-red-500">⚫ GRABANDO</p>
            )}
          </div>
          <div className="text-sm">
            <p>
              <strong>M</strong> - Cambiar modo de visualización
            </p>
            <p>
              <strong>I</strong> - Cambiar modo de interacción
            </p>
            <p>
              <strong>A</strong> - Activar/desactivar reactividad de audio
            </p>
            <p>
              <strong>G</strong> - Activar/desactivar control por gestos
            </p>
            <p>
              <strong>Espacio</strong> - Pausar/Continuar
            </p>
            <p>
              <strong>H</strong> - Ocultar/Mostrar esta información
            </p>
            <p>
              <strong>S</strong> - Capturar imagen (screenshot)
            </p>
            <p>
              <strong>R</strong> - Iniciar/detener grabación de video
            </p>
          </div>

          {captureMode && (
            <div className="mt-2 pt-2 border-t border-white border-opacity-30">
              <h3 className="font-bold mb-1">Modo de captura</h3>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={takeScreenshot}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded"
                >
                  Capturar imagen
                </button>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`${
                    isRecording
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  } text-white py-1 px-3 rounded`}
                >
                  {isRecording ? "Detener grabación" : "Grabar video"}
                </button>
              </div>
            </div>
          )}

          {audioEnabled && (
            <div className="mt-2 pt-2 border-t border-white border-opacity-30">
              <h3 className="font-bold mb-1">Audio reactivo</h3>
              <div className="w-full bg-gray-700 h-2 rounded overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all duration-100"
                  style={{ width: `${audioIntensityRef.current * 100}%` }}
                ></div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => {
                    setAudioSource("mic");
                    cleanupAudioContext();
                    setupAudioAnalysis("mic");
                  }}
                  className={`${
                    audioSource === "mic" ? "bg-blue-600" : "bg-gray-600"
                  } hover:bg-blue-700 text-white py-1 px-2 rounded text-xs`}
                >
                  Micrófono
                </button>
                <button
                  onClick={() => {
                    setAudioSource("system");
                    cleanupAudioContext();
                    setupAudioAnalysis("system");
                  }}
                  className={`${
                    audioSource === "system" ? "bg-blue-600" : "bg-gray-600"
                  } hover:bg-blue-700 text-white py-1 px-2 rounded text-xs`}
                >
                  Audio del Sistema
                </button>
                <button
                  onClick={() => {
                    setAudioSource("file");
                    cleanupAudioContext();
                    setupAudioAnalysis("file");
                  }}
                  className={`${
                    audioSource === "file" ? "bg-blue-600" : "bg-gray-600"
                  } hover:bg-blue-700 text-white py-1 px-2 rounded text-xs`}
                >
                  Archivo de audio
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
