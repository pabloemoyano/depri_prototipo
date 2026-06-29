import React, { useEffect, useRef, useState } from "react";
import { 
  Network, 
  Search, 
  RefreshCw, 
  Eye, 
  Sparkles, 
  FileText, 
  FolderOpen,
  Info,
  Maximize2,
  Sun,
  Moon,
  Compass,
  Layers,
  RotateCw
} from "lucide-react";

interface FileNode {
  name: string;
  type: "directory" | "file";
  path: string;
  size?: number;
  children?: FileNode[];
}

interface MapaArquitecturaProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const MapaArquitectura = ({ apiFetch }: MapaArquitecturaProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [projectStructure, setProjectStructure] = useState<FileNode | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState<number>(0);
  const [stats, setStats] = useState({ totalFiles: 0, totalDirs: 0 });
  const [physicsEnabled, setPhysicsEnabled] = useState<boolean>(true);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<{ name: string; path: string; type: string; size?: number } | null>(null);

  // Check if system or localStorage uses dark mode
  const [isLocalDarkMode, setIsLocalDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("pe_mapa_dark_mode");
    if (saved !== null) {
      return saved === "true";
    }
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    localStorage.setItem("pe_mapa_dark_mode", String(isLocalDarkMode));
  }, [isLocalDarkMode]);

  // 3D View states and refs
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [camera, setCamera] = useState({
    yaw: -0.5,
    pitch: 0.3,
    zoom: 1.0,
    panX: 0,
    panY: 0,
    panZ: 0
  });

  const nodes3DRef = useRef<any[]>([]);
  const links3DRef = useRef<any[]>([]);

  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastCameraRef = useRef({ yaw: 0, pitch: 0, panX: 0, panY: 0 });
  const dragButtonRef = useRef<number>(0);

  // Fetch the project file structure
  const fetchStructure = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiFetch("/api/project/structure");
      if (!res.ok) {
        throw new Error("No se pudo obtener la estructura del proyecto.");
      }
      const data = await res.json();
      setProjectStructure(data);

      // Simple stats calculation
      let files = 0;
      let dirs = 0;
      function countNodes(node: FileNode) {
        if (node.type === "directory") {
          dirs++;
        } else {
          files++;
        }
        if (node.children) {
          node.children.forEach(countNodes);
        }
      }
      if (data) countNodes(data);
      setStats({ totalFiles: files, totalDirs: dirs });

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al cargar la arquitectura.");
    } finally {
      setLoading(false);
    }
  };

  // Load structure on mount
  useEffect(() => {
    fetchStructure();
  }, []);

  // Load VisJS CDN Script and render Network when data or dark mode changes
  useEffect(() => {
    if (!projectStructure || viewMode !== "2d") return;

    // Loading UMD CDN script of vis-network
    let script = document.getElementById("vis-network-cdn") as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = "vis-network-cdn";
      script.src = "https://unpkg.com/vis-network/standalone/umd/vis-network.min.js";
      script.async = true;
      document.body.appendChild(script);
    }

    const initNetwork = () => {
      if (!containerRef.current || !(window as any).vis) return;

      const vis = (window as any).vis;

      // Build Nodes and Edges representation for Vis.js
      const rawNodes: any[] = [];
      const rawEdges: any[] = [];

      // Central node
      rawNodes.push({
        id: ".",
        label: "De Primera\n(Core Node)",
        shape: "box",
        margin: 16,
        color: {
          background: isLocalDarkMode ? "#10b981" : "#047857",
          border: isLocalDarkMode ? "#34d399" : "#065f46",
          hover: {
            background: isLocalDarkMode ? "#34d399" : "#059669",
            border: isLocalDarkMode ? "#6ee7b7" : "#047857"
          },
          highlight: {
            background: "#10b981",
            border: "#ffffff"
          }
        },
        font: {
          color: isLocalDarkMode ? "#091426" : "#ffffff",
          face: "Inter, sans-serif",
          size: 15,
          bold: {
            color: isLocalDarkMode ? "#091426" : "#ffffff",
            weight: "black"
          }
        },
        borderWidth: 3,
        shadow: { enabled: true, color: "rgba(0,0,0,0.3)", size: 10, x: 3, y: 3 }
      });

      // Traverse children recursively
      function traverse(node: FileNode, parentId?: string) {
        if (node.path === "." || !node.path) return;

        const isDir = node.type === "directory";
        const cleanName = node.name;

        // Visual rules matching the palette of "De Primera"
        let bg = "";
        let border = "";
        let textColor = "";
        const isComp = node.path.includes("src/components");
        const isAsset = node.path.includes("assets");
        const isDb = node.path === "server.ts" || node.path.includes("src/lib/firebase");

        if (isDir) {
          bg = isLocalDarkMode ? "#112038" : "#0f172a";
          border = isLocalDarkMode ? "#1e293b" : "#334155";
          textColor = "#ffffff";
        } else {
          if (isDb) {
            bg = isLocalDarkMode ? "#0284c7" : "#0369a1";
            border = isLocalDarkMode ? "#38bdf8" : "#0284c7";
            textColor = "#ffffff";
          } else if (isComp) {
            bg = isLocalDarkMode ? "#1e293b" : "#f1f5f9";
            border = isLocalDarkMode ? "#10b981" : "#16a34a";
            textColor = isLocalDarkMode ? "#34d399" : "#15803d";
          } else if (isAsset) {
            bg = isLocalDarkMode ? "#581c87" : "#fae8ff";
            border = isLocalDarkMode ? "#a855f7" : "#d8b4fe";
            textColor = isLocalDarkMode ? "#e9d5ff" : "#7e22ce";
          } else {
            bg = isLocalDarkMode ? "#1e293b" : "#f8fafc";
            border = isLocalDarkMode ? "#475569" : "#cbd5e1";
            textColor = isLocalDarkMode ? "#cbd5e1" : "#334155";
          }
        }

        rawNodes.push({
          id: node.path,
          label: cleanName,
          shape: "box",
          margin: 10,
          color: {
            background: bg,
            border: border,
            hover: {
              background: isLocalDarkMode ? "#10b981" : "#34d399",
              border: isLocalDarkMode ? "#34d399" : "#10b981"
            },
            highlight: {
              background: "#34d399",
              border: "#ffffff"
            }
          },
          font: {
            color: textColor,
            face: "JetBrains Mono, monospace",
            size: isDir ? 11 : 10,
            bold: isDir
          },
          borderWidth: isDir ? 2 : 1,
          borderRadius: isDir ? 8 : 4
        });

        // Edge link mapping
        rawEdges.push({
          from: parentId || ".",
          to: node.path,
          color: {
            color: isLocalDarkMode ? "#1e293b" : "#cbd5e1",
            highlight: "#10b981",
            hover: '#10b981'
          },
          width: isDir ? 2 : 1
        });

        if (node.children) {
          node.children.forEach((child) => traverse(child, node.path));
        }
      }

      if (projectStructure.children) {
        projectStructure.children.forEach((child) => traverse(child));
      }

      // Initialize datasets
      const nodesDataset = new vis.DataSet(rawNodes);
      const edgesDataset = new vis.DataSet(rawEdges);

      const options = {
        physics: {
          enabled: physicsEnabled,
          solver: "forceAtlas2Based",
          forceAtlas2Based: {
            gravitationalConstant: -120,
            centralGravity: 0.015,
            springLength: 110,
            springConstant: 0.06,
            damping: 0.35,
            avoidOverlap: 1
          }
        },
        interaction: {
          hover: true,
          zoomView: true,
          dragView: true,
          dragNodes: true,
          tooltipDelay: 200
        },
        edges: {
          smooth: {
            type: "cubicBezier",
            forceDirection: "none",
            roundness: 0.3
          },
          arrows: {
            to: { enabled: false }
          }
        }
      };

      const data = { nodes: nodesDataset, edges: edgesDataset };
      const network = new vis.Network(containerRef.current, data, options);
      networkRef.current = network;

      // Event listener for Node clicks to display node info sidebar
      network.on("click", (params: any) => {
        if (params.nodes && params.nodes.length > 0) {
          const selectedId = params.nodes[0];
          if (selectedId === ".") {
            setSelectedNodeInfo({
              name: "De Primera",
              path: "./",
              type: "directory",
              size: undefined
            });
            return;
          }
          // Find the node metadata in our projectTree
          let found: FileNode | null = null;
          function findNode(curr: FileNode) {
            if (curr.path === selectedId) {
              found = curr;
              return;
            }
            if (curr.children) {
              curr.children.forEach(findNode);
            }
          }
          findNode(projectStructure);

          if (found) {
            setSelectedNodeInfo({
              name: (found as FileNode).name,
              path: (found as FileNode).path,
              type: (found as FileNode).type,
              size: (found as FileNode).size
            });
          }
        } else {
          setSelectedNodeInfo(null);
        }
      });
    };

    if ((window as any).vis) {
      initNetwork();
    } else {
      script.addEventListener("load", initNetwork);
    }

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [projectStructure, isLocalDarkMode, physicsEnabled, viewMode]);

  // Handle local searching through files
  useEffect(() => {
    if (!projectStructure || searchQuery.trim() === "") {
      setSearchMatches([]);
      setSearchIndex(0);
      return;
    }

    const matches: string[] = [];
    function searchTree(node: FileNode) {
      if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        matches.push(node.path);
      }
      if (node.children) {
        node.children.forEach(searchTree);
      }
    }
    searchTree(projectStructure);
    // Add central core match explicitly
    if ("de primera".includes(searchQuery.toLowerCase()) || "core".includes(searchQuery.toLowerCase())) {
      matches.unshift(".");
    }

    setSearchMatches(matches);
    setSearchIndex(0);

    // Focus on first match instantly
    if (matches.length > 0 && networkRef.current) {
      networkRef.current.selectNodes([matches[0]]);
      networkRef.current.focus(matches[0], {
        scale: 1.3,
        animation: {
          duration: 600,
          easingFunction: "easeInOutQuad"
        }
      });

      // Fetch node data details
      if (matches[0] === ".") {
        setSelectedNodeInfo({
          name: "De Primera",
          path: "./",
          type: "directory"
        });
      } else {
        let foundNode: FileNode | null = null;
        const findNode = (curr: FileNode) => {
          if (curr.path === matches[0]) foundNode = curr;
          curr.children?.forEach(findNode);
        };
        findNode(projectStructure);
        if (foundNode) {
          setSelectedNodeInfo({
            name: (foundNode as FileNode).name,
            path: (foundNode as FileNode).path,
            type: (foundNode as FileNode).type,
            size: (foundNode as FileNode).size
          });
        }
      }
    }
  }, [searchQuery, projectStructure]);

  const handleNextSearch = () => {
    if (searchMatches.length === 0 || !networkRef.current) return;
    const nextIdx = (searchIndex + 1) % searchMatches.length;
    setSearchIndex(nextIdx);
    const targetId = searchMatches[nextIdx];

    networkRef.current.selectNodes([targetId]);
    networkRef.current.focus(targetId, {
      scale: 1.3,
      animation: {
        duration: 500,
        easingFunction: "easeInOutQuad"
      }
    });

    if (targetId === ".") {
      setSelectedNodeInfo({
        name: "De Primera",
        path: "./",
        type: "directory"
      });
    } else if (projectStructure) {
      let foundNode: FileNode | null = null;
      const findNode = (curr: FileNode) => {
        if (curr.path === targetId) foundNode = curr;
        curr.children?.forEach(findNode);
      };
      findNode(projectStructure);
      if (foundNode) {
        setSelectedNodeInfo({
          name: (foundNode as FileNode).name,
          path: (foundNode as FileNode).path,
          type: (foundNode as FileNode).type,
          size: (foundNode as FileNode).size
        });
      }
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSearchMatches([]);
    setSearchIndex(0);
    setSelectedNodeInfo(null);
    if (networkRef.current) {
      networkRef.current.fit({
        animation: {
          duration: 800,
          easingFunction: "easeOutQuart"
        }
      });
    }
  };

  const togglePhysics = () => {
    setPhysicsEnabled(!physicsEnabled);
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredNode3D, setHoveredNode3D] = useState<any | null>(null);

  const build3DGraph = (rootNode: FileNode) => {
    const nodes: any[] = [];
    const links: any[] = [];
    let dirIdx = 0;
    let fileIdx = 0;

    const traverse = (node: FileNode, parentId: string | null = null, depth = 0, indexInParent = 0, totalSiblings = 1) => {
      let x = 0;
      let y = 0;
      let z = 0;

      const isDir = node.type === "directory";
      const isComp = node.path.includes("src/components/");
      const isAsset = node.path.includes("src/assets/") || node.path.includes("public/");
      const isDb = node.path === "server.ts" || node.path.includes("src/lib/firebase");

      if (parentId === null) {
        // Root node
        x = 0;
        y = 120;
        z = 0;
      } else {
        if (isDir) {
          dirIdx++;
          // Place directory layers as tiered circular orbits going downwards
          const dirAngle = (dirIdx * 1.5) % (Math.PI * 2);
          const radius = 140 + depth * 35;
          x = radius * Math.cos(dirAngle);
          y = 80 - depth * 50;
          z = radius * Math.sin(dirAngle);
        } else {
          fileIdx++;
          // Place files in a gorgeous spiraling architectural cloud layered by category
          let baseHeight = 0;
          let spreadRadius = 180;
          let fileAngle = (fileIdx * 0.4) % (Math.PI * 2);

          if (isDb) {
            baseHeight = -140; // DB Core files at bottom level
            spreadRadius = 90;
          } else if (isComp) {
            baseHeight = 80;  // UI Components at high level
            spreadRadius = 240;
          } else if (isAsset) {
            baseHeight = -70; // Assets/Media lower-middle
            spreadRadius = 160;
          } else {
            baseHeight = 0;   // Default files in center-middle
            spreadRadius = 150;
          }

          // Add a bit of spiral distribution
          x = (spreadRadius + indexInParent * 12) * Math.cos(fileAngle);
          y = baseHeight + (indexInParent % 3) * 15 - 20;
          z = (spreadRadius + indexInParent * 12) * Math.sin(fileAngle);
        }
      }

      // Assign gorgeous glow styles
      let color = "#10b981";
      let borderStyle = "#047857";

      if (isDir) {
        color = isLocalDarkMode ? "#1e293b" : "#0f172a";
        borderStyle = isLocalDarkMode ? "#3b82f6" : "#475569";
      } else if (isDb) {
        color = "#0284c7";
        borderStyle = "#38bdf8";
      } else if (isComp) {
        color = isLocalDarkMode ? "#059669" : "#10b981";
        borderStyle = isLocalDarkMode ? "#34d399" : "#059669";
      } else if (isAsset) {
        color = "#7e22ce";
        borderStyle = "#c084fc";
      } else {
        color = isLocalDarkMode ? "#475569" : "#94a3b8";
        borderStyle = isLocalDarkMode ? "#64748b" : "#cbd5e1";
      }

      nodes.push({
        id: node.path,
        name: node.name,
        path: node.path,
        type: node.type,
        size: node.size,
        x,
        y,
        z,
        color,
        borderStyle,
        depth,
        radius: isDir ? 10 : 5
      });

      if (parentId) {
        links.push({
          from: parentId,
          to: node.path,
          color: isLocalDarkMode ? "rgba(59, 130, 246, 0.2)" : "rgba(100, 116, 139, 0.15)"
        });
      }

      if (node.children && node.children.length > 0) {
        node.children.forEach((child, idx) => {
          traverse(child, node.path, depth + 1, idx, node.children!.length);
        });
      }
    };

    if (rootNode) {
      traverse(rootNode);
    }
    nodes3DRef.current = nodes;
    links3DRef.current = links;
  };

  useEffect(() => {
    if (projectStructure) {
      build3DGraph(projectStructure);
    }
  }, [projectStructure, isLocalDarkMode]);

  // 3D Rendering Canvas Loop
  useEffect(() => {
    if (viewMode !== "3d" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let localYaw = camera.yaw;
    let localPitch = camera.pitch;
    let localZoom = camera.zoom;
    let localPanX = camera.panX;
    let localPanY = camera.panY;

    // Handle canvas resizing
    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = rect?.width || 800;
      canvas.height = rect?.height || 500;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Keep local values in sync with state transitions, but animate locally for zero latency!
    const renderLoop = () => {
      if (autoRotate) {
        localYaw += 0.003;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw background grid base for perspective feeling
      ctx.strokeStyle = isLocalDarkMode ? "rgba(30, 41, 59, 0.4)" : "rgba(226, 232, 240, 0.6)";
      ctx.lineWidth = 1;
      
      // Draw Concentric Floor Grid Lines
      for (let r = 50; r <= 300; r += 50) {
        ctx.beginPath();
        // project a circle in 3D floor plane (y = -120)
        for (let a = 0; a <= Math.PI * 2; a += 0.15) {
          const gx = r * Math.cos(a);
          const gz = r * Math.sin(a);
          const gy = -100; // grid floor

          // Rotate
          const x1 = gx * Math.cos(localYaw) - gz * Math.sin(localYaw);
          const z1 = gx * Math.sin(localYaw) + gz * Math.cos(localYaw);
          const y2 = gy * Math.cos(localPitch) - z1 * Math.sin(localPitch);
          const z2 = gy * Math.sin(localPitch) + z1 * Math.cos(localPitch);

          // Pan
          const rx = x1 + localPanX;
          const ry = y2 + localPanY;

          // Project
          const dist = 400;
          const persp = dist / (dist + z2);
          const sx = cx + rx * persp * localZoom;
          const sy = cy + ry * persp * localZoom;

          if (a === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Project all nodes
      const projectedNodes = nodes3DRef.current.map(node => {
        // Rotate horizontal
        const x1 = node.x * Math.cos(localYaw) - node.z * Math.sin(localYaw);
        const z1 = node.x * Math.sin(localYaw) + node.z * Math.cos(localYaw);
        // Rotate vertical
        const y2 = node.y * Math.cos(localPitch) - z1 * Math.sin(localPitch);
        const z2 = node.y * Math.sin(localPitch) + z1 * Math.cos(localPitch);

        // Pan
        const rx = x1 + localPanX;
        const ry = y2 + localPanY;

        // Perspective
        const dist = 400;
        const persp = dist / (dist + z2);
        const sx = cx + rx * persp * localZoom;
        const sy = cy + ry * persp * localZoom;

        return {
          ...node,
          sx,
          sy,
          sz: z2, // keep depth for painter's sorting
          persp
        };
      });

      // Draw connecting structural lines first
      links3DRef.current.forEach(link => {
        const fromNode = projectedNodes.find(n => n.id === link.from);
        const toNode = projectedNodes.find(n => n.id === link.to);

        if (fromNode && toNode) {
          // Fade links with distance (depth fog)
          const avgZ = (fromNode.sz + toNode.sz) / 2;
          const opacity = Math.max(0.05, Math.min(0.6, 1 - (avgZ + 200) / 400));
          
          ctx.beginPath();
          ctx.strokeStyle = isLocalDarkMode 
            ? `rgba(59, 130, 246, ${opacity})` 
            : `rgba(100, 116, 139, ${opacity})`;
          ctx.lineWidth = Math.max(0.5, 1.5 * ((fromNode.persp + toNode.persp) / 2));
          ctx.moveTo(fromNode.sx, fromNode.sy);
          ctx.lineTo(toNode.sx, toNode.sy);
          ctx.stroke();
        }
      });

      // Sort nodes back-to-front (Painter's algorithm)
      const sortedNodes = [...projectedNodes].sort((a, b) => b.sz - a.sz);

      // Draw nodes
      sortedNodes.forEach(node => {
        const isHovered = hoveredNode3D?.id === node.id;
        const isSelected = selectedNodeInfo?.path === node.path;
        const size = node.radius * node.persp * localZoom * (isHovered ? 1.4 : 1.0);

        if (size <= 0.5) return; // skip tiny clipped nodes

        ctx.save();
        
        // Depth-based shadow or glow
        ctx.beginPath();
        const glowSize = size * (isSelected ? 2.5 : 1.8);
        const radGrd = ctx.createRadialGradient(node.sx, node.sy, size * 0.1, node.sx, node.sy, glowSize);
        
        if (isLocalDarkMode) {
          radGrd.addColorStop(0, node.borderStyle);
          radGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
        } else {
          radGrd.addColorStop(0, node.color);
          radGrd.addColorStop(1, "rgba(255, 255, 255, 0)");
        }
        
        ctx.fillStyle = radGrd;
        ctx.arc(node.sx, node.sy, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Node core circle
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, size, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.strokeStyle = isSelected ? "#34d399" : node.borderStyle;
        ctx.lineWidth = isSelected || isHovered ? 3 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Node Labels (Only for key folders, components or hovered/selected elements to maintain visual cleanliness)
        const isImportant = node.type === "directory" || node.id === "server.ts" || node.id === "src/App.tsx";
        if (isHovered || isSelected || (isImportant && node.persp > 0.7)) {
          ctx.font = isHovered || isSelected ? "bold 11px Inter, sans-serif" : "9px Inter, sans-serif";
          ctx.fillStyle = isLocalDarkMode ? "#f8fafc" : "#0f172a";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          
          // Background bubble for easy reading
          const textY = node.sy + size + 4;
          const textWidth = ctx.measureText(node.name).width;
          ctx.fillStyle = isLocalDarkMode ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.85)";
          ctx.fillRect(node.sx - textWidth / 2 - 4, textY - 2, textWidth + 8, 14);
          ctx.strokeStyle = isLocalDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
          ctx.strokeRect(node.sx - textWidth / 2 - 4, textY - 2, textWidth + 8, 14);

          ctx.fillStyle = isLocalDarkMode ? "#cbd5e1" : "#1e293b";
          ctx.fillText(node.name, node.sx, textY);
        }

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [viewMode, autoRotate, camera, isLocalDarkMode, hoveredNode3D, selectedNodeInfo]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    lastCameraRef.current = {
      yaw: camera.yaw,
      pitch: camera.pitch,
      panX: camera.panX,
      panY: camera.panY
    };
    dragButtonRef.current = e.button;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Detect hovered node
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Find if we are hovering any projected node
    let closestNode: any = null;
    let minDistance = 20; // 20px threshold

    nodes3DRef.current.forEach(node => {
      // Calculate node's projected coordinates using current camera state
      const x1 = node.x * Math.cos(camera.yaw) - node.z * Math.sin(camera.yaw);
      const z1 = node.x * Math.sin(camera.yaw) + node.z * Math.cos(camera.yaw);
      const y2 = node.y * Math.cos(camera.pitch) - z1 * Math.sin(camera.pitch);
      const z2 = node.y * Math.sin(camera.pitch) + z1 * Math.cos(camera.pitch);

      const rx = x1 + camera.panX;
      const ry = y2 + camera.panY;

      const dist = 400;
      const persp = dist / (dist + z2);
      const sx = cx + rx * persp * camera.zoom;
      const sy = cy + ry * persp * camera.zoom;

      const d = Math.hypot(mx - sx, my - sy);
      if (d < minDistance) {
        minDistance = d;
        closestNode = node;
      }
    });

    setHoveredNode3D(closestNode);

    // 2. Handle dragging camera navigation
    if (!isDraggingRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    if (dragButtonRef.current === 0) {
      // Left click dragging -> Rotate Yaw and Pitch
      setCamera(prev => ({
        ...prev,
        yaw: lastCameraRef.current.yaw - deltaX * 0.007,
        pitch: Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, lastCameraRef.current.pitch + deltaY * 0.007))
      }));
    } else {
      // Right click or other dragging -> Pan view
      setCamera(prev => ({
        ...prev,
        panX: lastCameraRef.current.panX + deltaX * 0.5,
        panY: lastCameraRef.current.panY + deltaY * 0.5
      }));
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = 1 - e.deltaY * 0.001;
    setCamera(prev => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(8.0, prev.zoom * zoomFactor))
    }));
  };

  const handleCanvasClick = () => {
    if (hoveredNode3D) {
      setSelectedNodeInfo({
        name: hoveredNode3D.name,
        path: hoveredNode3D.path,
        type: hoveredNode3D.type,
        size: hoveredNode3D.size
      });
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastCameraRef.current = {
        yaw: camera.yaw,
        pitch: camera.pitch,
        panX: camera.panX,
        panY: camera.panY
      };
      dragButtonRef.current = 0; // Simulate left click rotation
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - dragStartRef.current.x;
    const deltaY = e.touches[0].clientY - dragStartRef.current.y;

    setCamera(prev => ({
      ...prev,
      yaw: lastCameraRef.current.yaw - deltaX * 0.008,
      pitch: Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, lastCameraRef.current.pitch + deltaY * 0.008))
    }));
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-130px)] rounded-3xl overflow-hidden shadow-xs relative border transition-all duration-300 ${
      isLocalDarkMode 
        ? "bg-slate-950 border-slate-800 text-slate-100 dark:bg-slate-950 dark:border-slate-800" 
        : "bg-white border-slate-200 text-slate-800"
    }`}>
      
      {/* Dynamic Module Header Panel */}
      <div className={`px-6 py-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 select-none transition-all duration-300 ${
        isLocalDarkMode 
          ? "bg-slate-900/60 border-slate-800/80" 
          : "bg-slate-50 border-slate-200"
      }`}>
        
        {/* Left branding */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isLocalDarkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/10 text-emerald-600"}`}>
            {viewMode === "3d" ? (
              <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: "10s" }} />
            ) : (
              <Network className="w-5 h-5 animate-pulse" />
            )}
          </div>
          <div>
            <h1 className={`text-sm font-black uppercase tracking-widest leading-none ${isLocalDarkMode ? "text-white" : "text-slate-900"}`}>
              Mapa de Arquitectura {viewMode === "3d" ? "3D" : "2D"}
            </h1>
            <p className={`text-[10px] mt-1 font-bold ${isLocalDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {viewMode === "3d" 
                ? "Navegación espacial inmersiva, rotación libre y sumergimiento del código" 
                : "Visualización elástica y viva del árbol físico de código fuente del proyecto"}
            </p>
          </div>
        </div>

        {/* Right Actionable Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar input with indicator matches */}
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isLocalDarkMode ? "text-slate-500" : "text-slate-400"}`} />
            <input 
              type="text"
              placeholder="Buscar archivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`text-xs pl-10 pr-16 py-2 rounded-xl border focus:outline-hidden transition w-52 ${
                isLocalDarkMode 
                  ? "bg-slate-900 border-slate-800 text-slate-200 focus:border-emerald-500" 
                  : "bg-white border-slate-200 text-slate-800 focus:border-emerald-500"
              }`}
            />
            {searchMatches.length > 0 && (
              <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 font-mono text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                isLocalDarkMode ? "bg-emerald-950 text-emerald-300" : "bg-emerald-100 text-emerald-800"
              }`}>
                <span>{searchIndex + 1}/{searchMatches.length}</span>
                <button 
                  onClick={handleNextSearch}
                  className="font-black hover:text-emerald-500 cursor-pointer transition px-1"
                  title="Siguiente coincidencia"
                >
                  🚀
                </button>
              </div>
            )}
          </div>

          {/* 2D / 3D Mode Selector Buttons */}
          <div className={`flex rounded-xl p-0.5 border ${
            isLocalDarkMode ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"
          }`}>
            <button
              onClick={() => setViewMode("2d")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === "2d"
                  ? (isLocalDarkMode ? "bg-slate-800 text-white shadow-xs" : "bg-white text-slate-900 shadow-xs")
                  : "text-slate-400 hover:text-slate-200 dark:text-slate-500 dark:hover:text-slate-300"
              }`}
              title="Activar vista plana elástica"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Vista 2D</span>
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === "3d"
                  ? (isLocalDarkMode ? "bg-emerald-500 text-slate-950 shadow-xs" : "bg-slate-900 text-white shadow-xs")
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300"
              }`}
              title="Activar holograma tridimensional"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Vista 3D</span>
            </button>
          </div>

          {/* Toggle forces button (Only in 2D mode) */}
          {viewMode === "2d" && (
            <button
              onClick={togglePhysics}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                physicsEnabled 
                  ? (isLocalDarkMode ? "bg-emerald-500 text-slate-950 border-transparent shadow-xs" : "bg-slate-900 text-white border-transparent shadow-xs")
                  : (isLocalDarkMode ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-400" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600")
              }`}
              title="Activa o congela la simulación de físicas"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Físicas: {physicsEnabled ? 'Activas' : 'Estáticas'}</span>
            </button>
          )}

          {/* Synchronize files tree */}
          <button
            onClick={fetchStructure}
            disabled={loading}
            className={`p-2 border rounded-xl cursor-pointer transition disabled:opacity-50 inline-flex items-center justify-center ${
              isLocalDarkMode ? "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
            }`}
            title="Volver a escanear archivos del workspace"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>

          {/* Reset Zoom Button */}
          <button
            onClick={viewMode === "3d" 
              ? () => setCamera({ yaw: -0.5, pitch: 0.3, zoom: 1.0, panX: 0, panY: 0, panZ: 0 })
              : handleResetFilters
            }
            className={`p-2 border rounded-xl cursor-pointer transition inline-flex items-center justify-center ${
              isLocalDarkMode ? "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
            }`}
            title="Ajustar zoom al centro del mapa"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Local Dark Mode Exclusivo Button */}
          <button
            onClick={() => setIsLocalDarkMode(!isLocalDarkMode)}
            className={`p-2 border rounded-xl cursor-pointer transition inline-flex items-center justify-center ${
              isLocalDarkMode 
                ? "bg-slate-900 hover:bg-slate-800 border-slate-800 text-amber-400" 
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
            }`}
            title={isLocalDarkMode ? "Cambiar módulo a modo claro" : "Cambiar módulo a modo oscuro"}
          >
            {isLocalDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {loading ? (
        <div className={`flex-1 flex flex-col justify-center items-center gap-4 ${isLocalDarkMode ? "bg-slate-950" : "bg-slate-50"}`}>
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className={`text-xs font-bold uppercase tracking-widest ${isLocalDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            Escaneando estructura física del proyecto...
          </p>
        </div>
      ) : errorMsg ? (
        <div className={`flex-1 flex flex-col justify-center items-center gap-3 px-8 py-12 ${
          isLocalDarkMode ? "bg-red-950/10" : "bg-red-50/50"
        }`}>
          <div className="p-3 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-full">
            <Info className="w-8 h-8" />
          </div>
          <h2 className={`text-sm font-black uppercase tracking-wider ${isLocalDarkMode ? "text-white" : "text-slate-900"}`}>Error de Lectura</h2>
          <p className="text-xs text-rose-700 dark:text-rose-400 text-center max-w-sm font-semibold">{errorMsg}</p>
          <button 
            onClick={fetchStructure}
            className={`mt-2 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer ${
              isLocalDarkMode ? "bg-slate-100 text-slate-900 hover:bg-white" : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            Reintentar escanear
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row relative">
          
          {/* Main Visualizer Stage Canvas */}
          <div className={`flex-1 h-full min-h-[350px] relative transition-colors duration-300 ${isLocalDarkMode ? "bg-slate-950" : "bg-slate-50"}`}>
            
            {viewMode === "2d" ? (
              <div ref={containerRef} className="w-full h-full absolute inset-0" />
            ) : (
              <div className="w-full h-full absolute inset-0">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onWheel={handleWheel}
                  onClick={handleCanvasClick}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="w-full h-full block cursor-grab active:cursor-grabbing"
                />

                {/* 3D Immersive Controller Panel */}
                <div className={`absolute right-4 top-4 flex flex-col gap-2 p-2.5 rounded-2xl border shadow-lg z-10 w-fit backdrop-blur-md transition-all ${
                  isLocalDarkMode ? "bg-slate-900/90 border-slate-800 text-white" : "bg-white/95 border-slate-200 text-slate-800"
                }`}>
                  <button
                    onClick={() => setAutoRotate(!autoRotate)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      autoRotate 
                        ? (isLocalDarkMode ? "bg-emerald-500 text-slate-950 border-transparent shadow-xs" : "bg-slate-900 text-white border-transparent shadow-xs")
                        : (isLocalDarkMode ? "bg-slate-800 hover:bg-slate-755 border-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 border-slate-250 text-slate-600")
                    }`}
                    title="Alternar rotación automática horizontal"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? "animate-spin" : ""}`} />
                    <span className="text-[10px]">Auto Rotar</span>
                  </button>
                  <div className={`h-px my-1 ${isLocalDarkMode ? "bg-slate-800" : "bg-slate-200"}`} />
                  <div className="flex flex-col gap-1 text-center font-bold">
                    <button
                      onClick={() => setCamera(c => ({ ...c, zoom: Math.min(8, c.zoom * 1.25) }))}
                      className={`px-2 py-1 text-[10px] rounded-lg cursor-pointer transition text-left ${
                        isLocalDarkMode ? "hover:bg-slate-850 text-slate-300" : "hover:bg-slate-100 text-slate-600"
                      }`}
                      title="Sumergirse en la red 3D"
                    >
                      🚀 Sumergirse (Zoom +)
                    </button>
                    <button
                      onClick={() => setCamera(c => ({ ...c, zoom: Math.max(0.15, c.zoom / 1.25) }))}
                      className={`px-2 py-1 text-[10px] rounded-lg cursor-pointer transition text-left ${
                        isLocalDarkMode ? "hover:bg-slate-850 text-slate-300" : "hover:bg-slate-100 text-slate-600"
                      }`}
                      title="Alejar cámara de la red"
                    >
                      🛸 Alejarse (Zoom -)
                    </button>
                    <button
                      onClick={() => setCamera({ yaw: -0.5, pitch: 0.3, zoom: 1.0, panX: 0, panY: 0, panZ: 0 })}
                      className={`px-2 py-1 text-[10px] rounded-lg cursor-pointer transition text-left text-emerald-500`}
                      title="Restablecer yaw, pitch y zoom iniciales"
                    >
                      🔄 Reset Cámara
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Legend guide banner overlay */}
            <div className={`absolute left-4 bottom-4 backdrop-blur-md px-3.5 py-3 rounded-2xl border text-[10px] select-none pointer-events-none shadow-sm space-y-1.5 font-bold z-10 w-fit transition-all duration-300 ${
              isLocalDarkMode ? "bg-slate-950/90 border-slate-800" : "bg-white/90 border-slate-200"
            }`}>
              <span className={`text-[9px] uppercase tracking-wider block ${isLocalDarkMode ? "text-slate-500" : "text-slate-400"}`}>Leyenda de Nodos</span>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-500 rounded-xs border border-emerald-600 block shrink-0" />
                <span className={isLocalDarkMode ? "text-slate-350" : "text-slate-700"}>De Primera Core</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-xs border block shrink-0 ${isLocalDarkMode ? "bg-slate-900 border-slate-700" : "bg-[#0f172a] border-slate-700"}`} />
                <span className={isLocalDarkMode ? "text-slate-350" : "text-slate-700"}>Carpetas (Estructura)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#0369a1] rounded-xs border border-sky-400 block shrink-0" />
                <span className={isLocalDarkMode ? "text-slate-350" : "text-slate-700"}>Servidor y Firebase (Core DB)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-500 rounded-xs border border-emerald-400 block shrink-0" />
                <span className={isLocalDarkMode ? "text-slate-350" : "text-slate-700"}>Vistas y Componentes</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-xs border block shrink-0 ${isLocalDarkMode ? "bg-slate-600 border-slate-500" : "bg-slate-300 border-slate-400"}`} />
                <span className={isLocalDarkMode ? "text-slate-350" : "text-slate-700"}>Archivos / Configuración</span>
              </div>
            </div>

            {/* Quick interactive zoom help badge */}
            <div className={`absolute right-4 bottom-4 backdrop-blur-md px-3 py-1.5 rounded-lg text-[9px] pointer-events-none font-mono z-10 select-none shadow-xs transition-all ${
              isLocalDarkMode ? "bg-slate-900/80 text-slate-300" : "bg-slate-900/80 text-white/90"
            }`}>
              {viewMode === "3d" 
                ? "🖱 Clic izquierdo + Arrastrar para rotar | Clic derecho para desplazar | Rueda para sumergirte" 
                : "🖱 Scroll para zoom | Arrastrar para mover"}
            </div>
          </div>

          {/* Panel Lateral: Node Specific Metadata Detailer */}
          {selectedNodeInfo && (
            <div className={`w-full md:w-80 border-t md:border-t-0 md:border-l p-5 flex flex-col justify-between shrink-0 select-none shadow-xs z-20 animate-in slide-in-from-right-2 duration-150 transition-all ${
              isLocalDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
            }`}>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-black tracking-widest px-2.5 py-1 rounded-md uppercase ${
                    isLocalDarkMode ? "text-emerald-400 bg-emerald-500/15" : "text-emerald-800 bg-emerald-500/10"
                  }`}>
                    Elemento Seleccionado
                  </span>
                  <button 
                    onClick={() => setSelectedNodeInfo(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg"
                    title="Cerrar detalle"
                  >
                    ✕
                  </button>
                </div>

                <div className={`flex items-start gap-3 border-b pb-3 ${isLocalDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                  <div className={`p-2 rounded-xl shrink-0 ${
                    selectedNodeInfo.type === "directory" 
                      ? (isLocalDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700")
                      : (isLocalDarkMode ? "bg-emerald-950/40 text-emerald-300" : "bg-emerald-50 text-emerald-800")
                  }`}>
                    {selectedNodeInfo.type === "directory" ? <FolderOpen className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className={`text-xs font-black truncate ${isLocalDarkMode ? "text-white" : "text-slate-900"}`} title={selectedNodeInfo.name}>
                      {selectedNodeInfo.name}
                    </h3>
                    <p className="text-[10px] text-slate-450 dark:text-slate-400 font-mono truncate" title={selectedNodeInfo.path}>
                      {selectedNodeInfo.path}
                    </p>
                  </div>
                </div>

                <div className={`space-y-2 text-[10px] font-semibold font-mono ${isLocalDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                  <div className="flex justify-between">
                    <span>TIPO:</span>
                    <strong className={isLocalDarkMode ? "text-slate-200 uppercase" : "text-slate-800 uppercase"}>
                      {selectedNodeInfo.type === "directory" ? "Carpeta (Raíz)" : "Archivo de Código"}
                    </strong>
                  </div>
                  {selectedNodeInfo.size !== undefined && (
                    <div className="flex justify-between">
                      <span>TAMAÑO FÍSICO:</span>
                      <strong className={isLocalDarkMode ? "text-slate-200" : "text-slate-800"}>
                        {(selectedNodeInfo.size / 1024).toFixed(2)} KB ({selectedNodeInfo.size} bytes)
                      </strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>ACCESO:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">Lectura Local Directa</strong>
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border text-[10.5px] leading-relaxed font-semibold ${
                  isLocalDarkMode ? "bg-slate-950/80 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200/40 text-slate-500"
                }`}>
                  {selectedNodeInfo.type === "directory" ? (
                    "Esta carpeta contiene archivos agrupados del sistema. Podés arrastrarla o hacer clic en sus archivos hijos para conocerlos en detalle."
                  ) : (
                    "Este archivo es parte del núcleo de De Primera. Podés inspeccionar su localización física o buscar otros componentes similares."
                  )}
                </div>
              </div>

              {/* Quick Workspace Stats */}
              <div className={`border-t pt-3.5 mt-4 space-y-1 ${isLocalDarkMode ? "border-slate-800" : "border-slate-100"}`}>
                <span className={`text-[8px] font-black uppercase block tracking-widest ${isLocalDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  Resumen de Archivos Registrados
                </span>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className={`p-2 rounded-lg border ${
                    isLocalDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200/50"
                  }`}>
                    <span className={`font-mono text-xs font-black ${isLocalDarkMode ? "text-slate-200" : "text-slate-800"}`}>{stats.totalDirs}</span>
                    <span className="text-[8px] text-slate-400 block uppercase font-bold">Carpetas</span>
                  </div>
                  <div className={`p-2 rounded-lg border ${
                    isLocalDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200/50"
                  }`}>
                    <span className={`font-mono text-xs font-black ${isLocalDarkMode ? "text-slate-200" : "text-slate-800"}`}>{stats.totalFiles}</span>
                    <span className="text-[8px] text-slate-400 block uppercase font-bold">Archivos</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
};
