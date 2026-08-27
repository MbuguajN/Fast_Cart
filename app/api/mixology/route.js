import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const spirit = searchParams.get('spirit') || 'all';
    const brand = searchParams.get('brand') || 'all';
    const style = searchParams.get('style') || 'all';
    const difficulty = searchParams.get('difficulty') || 'all';

    const filePath = path.join(process.cwd(), 'data', 'mixology.json');
    let recipes = [];
    if (fs.existsSync(filePath)) {
      const fileData = fs.readFileSync(filePath, 'utf-8');
      recipes = JSON.parse(fileData);
    }

    // Extract dynamic distinct filter options
    const spirits = ['all', ...new Set(recipes.map((r) => r.spiritType).filter(Boolean))];
    const brands = ['all', ...new Set(recipes.map((r) => r.brand).filter(Boolean))];
    const styles = ['all', ...new Set(recipes.map((r) => r.drinkStyle).filter(Boolean))];
    const difficulties = ['all', 'Easy', 'Medium', 'Expert'];

    // Filter recipes
    const filtered = recipes.filter((r) => {
      if (spirit !== 'all' && r.spiritType?.toLowerCase() !== spirit.toLowerCase()) return false;
      if (brand !== 'all' && r.brand?.toLowerCase() !== brand.toLowerCase()) return false;
      if (style !== 'all' && r.drinkStyle?.toLowerCase() !== style.toLowerCase()) return false;
      if (difficulty !== 'all' && r.difficulty?.toLowerCase() !== difficulty.toLowerCase()) return false;

      if (search) {
        const text = `${r.title} ${r.description} ${r.brand} ${r.spiritType} ${r.ingredients?.join(' ')}`.toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    return NextResponse.json({
      success: true,
      total: recipes.length,
      filteredCount: filtered.length,
      recipes: filtered,
      filters: {
        spirits,
        brands,
        styles,
        difficulties,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load mixology data' }, { status: 500 });
  }
}

