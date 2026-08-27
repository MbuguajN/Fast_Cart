import { NextResponse } from 'next/server';
import { askAIBartender } from '@/lib/ai/bartender-engine';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { messages = [] } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const aiResult = await askAIBartender(messages);

    return NextResponse.json({
      success: true,
      message: {
        role: 'assistant',
        content: aiResult.content,
      },
      suggestedProducts: aiResult.suggestedProducts || [],
      suggestedRecipes: aiResult.suggestedRecipes || [],
      followUps: aiResult.followUps || [],
    });
  } catch (error) {
    console.error('AI Bartender Route Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process AI bartender request',
        fallback: {
          content: "Sorry, I took a quick break behind the bar! How else can I assist with your drinks, cocktails, or prices?",
          suggestedProducts: [],
          suggestedRecipes: [],
          followUps: ['Show me popular cocktails', 'Whiskey under 4,000 KSh', 'What can I make with Gin?'],
        },
      },
      { status: 500 }
    );
  }
}

