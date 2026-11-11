// 图片优化检查和建议脚本
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

async function analyzeImages(dir = 'public/images', results = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await analyzeImages(fullPath, results);
    } else if (/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
      const stats = await stat(fullPath);
      results.push({
        path: fullPath,
        size: stats.size,
        name: entry.name,
        ext: entry.name.split('.').pop().toLowerCase()
      });
    }
  }

  return results;
}

async function main() {
  console.log('🖼️  分析图片资源...\n');

  const images = await analyzeImages();
  const totalSize = images.reduce((sum, img) => sum + img.size, 0);

  console.log(`📊 统计信息：`);
  console.log(`   总文件数: ${images.length}`);
  console.log(`   总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);

  // 大文件分析
  const largeFiles = images.filter(img => img.size > 100 * 1024).sort((a, b) => b.size - a.size);
  if (largeFiles.length > 0) {
    console.log('⚠️  大文件 (>100KB):');
    largeFiles.slice(0, 10).forEach(img => {
      console.log(`   ${img.name}: ${(img.size / 1024).toFixed(1)} KB`);
    });
    console.log('');
  }

  // PNG文件建议
  const pngFiles = images.filter(img => img.ext === 'png');
  if (pngFiles.length > 0) {
    const pngSize = pngFiles.reduce((sum, img) => sum + img.size, 0);
    console.log(`💡 优化建议：`);
    console.log(`   发现 ${pngFiles.length} 个PNG文件，总计 ${(pngSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   建议转换为WebP格式，预计可节省 60-80% 体积\n`);
  }

  // 按格式统计
  const byFormat = images.reduce((acc, img) => {
    acc[img.ext] = (acc[img.ext] || 0) + img.size;
    return acc;
  }, {});

  console.log('📁 按格式统计:');
  Object.entries(byFormat).forEach(([ext, size]) => {
    console.log(`   ${ext.toUpperCase()}: ${(size / 1024 / 1024).toFixed(2)} MB`);
  });

  console.log('\n✅ 分析完成！');
}

main().catch(console.error);
