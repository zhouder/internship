import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

// 错误边界组件
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("应用错误:", error, errorInfo);
    // 这里可以添加错误上报
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <AlertTriangle size={48} color="#d64545" />
          <h1>抱歉，出现了一些问题</h1>
          <p>{this.state.error?.message || "页面加载失败"}</p>
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} />
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 加载骨架屏组件
export function Skeleton({ type = "card", count = 1 }) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (type === "card") {
    return (
      <>
        {items.map((i) => (
          <div key={i} className="resource-card skeleton-card">
            <div className="skeleton" style={{ width: 110, height: 114 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="skeleton" style={{ width: "80%", height: 20 }} />
              <div className="skeleton" style={{ width: "60%", height: 16 }} />
              <div className="skeleton" style={{ width: "90%", height: 14 }} />
              <div className="skeleton" style={{ width: "40%", height: 18, marginTop: "auto" }} />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (type === "kpi") {
    return (
      <>
        {items.map((i) => (
          <div key={i} className="kpi">
            <div className="skeleton" style={{ width: 24, height: 24 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: "60%", height: 14, marginBottom: 10 }} />
              <div className="skeleton" style={{ width: "50%", height: 32 }} />
              <div className="skeleton" style={{ width: "40%", height: 12, marginTop: 8 }} />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (type === "list") {
    return (
      <>
        {items.map((i) => (
          <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #f0f0f2" }}>
            <div className="skeleton" style={{ width: "70%", height: 16, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: "50%", height: 14 }} />
          </div>
        ))}
      </>
    );
  }

  return null;
}

// 懒加载图片组件
export function LazyImage({ src, alt, className, ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className={`lazy-image-wrapper ${className || ""}`}>
      {!loaded && !error && (
        <div className="skeleton" style={{ width: "100%", height: "100%", position: "absolute" }} />
      )}
      {error ? (
        <div className="image-error">
          <AlertTriangle size={24} color="#93979e" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease" }}
          loading="lazy"
          {...props}
        />
      )}
    </div>
  );
}

// 性能监控工具
export function performanceMonitor() {
  if (typeof window === "undefined") return;

  // 首屏加载时间
  window.addEventListener("load", () => {
    setTimeout(() => {
      const perfData = performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      const domReadyTime = perfData.domContentLoadedEventEnd - perfData.navigationStart;
      const ttfb = perfData.responseStart - perfData.navigationStart;

      console.log("性能指标:", {
        页面加载时间: `${pageLoadTime}ms`,
        DOM就绪时间: `${domReadyTime}ms`,
        首字节时间: `${ttfb}ms`,
      });

      // 这里可以上报到监控平台
      if (pageLoadTime > 3000) {
        console.warn("页面加载较慢，超过3秒");
      }
    }, 0);
  });

  // 资源加载监控
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 1000) {
        console.warn(`资源加载慢: ${entry.name} (${entry.duration}ms)`);
      }
    }
  });

  observer.observe({ entryTypes: ["resource"] });
}

import { useState } from "react";
