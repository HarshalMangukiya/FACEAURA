export class FallbackAssetResolver {
  private static fallbacks: Record<string, string> = {
    // Hair fallbacks (using stable, pre-tested models)
    'short_hair': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb',
    'long_hair': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb',
    'curly_hair': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb',
    
    // Beard fallbacks
    'short_beard': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb',
    'long_beard': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb',
    
    // Glasses fallbacks (using MindAR face-tracking glasses assets)
    'round_glasses': 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/face-tracking/assets/glasses1/scene.gltf',
    'rectangle_glasses': 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/face-tracking/assets/glasses2/scene.gltf',
    
    // Cap fallbacks (using MindAR hats & standard ThreeJS test models)
    'baseball_cap': 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/face-tracking/assets/hat1/scene.gltf',
    'beanie': 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/face-tracking/assets/hat2/scene.gltf',
    'fedora': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb'
  };

  /**
   * Resolves the target GLB/GLTF model URL.
   * If a custom 3D model path exists, it will use it directly.
   * Otherwise, maps name matches to fallback CDNs.
   */
  public static resolve(category: string, asset: any): string {
    if (!asset) return '';

    const url = typeof asset === 'string' ? asset : (asset.image || asset.url || '');
    if (!url) return '';

    let resolvedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';
      const cleanPath = url.startsWith('/') ? url : `/${url}`;
      resolvedUrl = `${apiBase}${cleanPath}`;
    }

    // If it's already a valid 3D file or image, prefer it
    const lower = resolvedUrl.toLowerCase();
    if (
      lower.endsWith('.glb') ||
      lower.endsWith('.gltf') ||
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.svg')
    ) {
      return resolvedUrl;
    }

    // Match image names or text names to find standard fallbacks
    const assetName = (asset.name || '').toLowerCase().replace(/[\s_-]/g, '');
    const categoryLower = category.toLowerCase();

    if (categoryLower === 'hair') {
      if (assetName.includes('long')) return this.fallbacks['long_hair']!;
      if (assetName.includes('curly') || assetName.includes('wave')) return this.fallbacks['curly_hair']!;
      return this.fallbacks['short_hair']!;
    }
    
    if (categoryLower === 'beard') {
      if (assetName.includes('long') || assetName.includes('full')) return this.fallbacks['long_beard']!;
      return this.fallbacks['short_beard']!;
    }

    if (categoryLower === 'glasses') {
      if (assetName.includes('rectangle') || assetName.includes('square') || assetName.includes('classic')) {
        return this.fallbacks['rectangle_glasses']!;
      }
      return this.fallbacks['round_glasses']!;
    }

    if (categoryLower === 'caps') {
      if (assetName.includes('beanie')) return this.fallbacks['beanie']!;
      if (assetName.includes('fedora') || assetName.includes('snapback')) return this.fallbacks['fedora']!;
      return this.fallbacks['baseball_cap']!;
    }

    return resolvedUrl;
  }
}

export default FallbackAssetResolver;
