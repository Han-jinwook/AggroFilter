import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
    const supabase = createClient();

    // 1. Admin Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { data: userProfile, error: profileError } = await supabase
        .from('t_user_profiles')
        .select('f_role')
        .eq('f_user_id', user.id)
        .single();

    if (profileError || userProfile?.f_role !== 'ADMIN') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // 2. Parse request
    const { miningCondition, period } = await req.json();

    try {
        let query = supabase
            .from('t_analysis_history')
            .select(`
                f_id,
                f_aggro_score,
                t_videos ( f_video_id, f_title, f_thumbnail_url )
            `)
            .order('f_created_at', { ascending: false })
            .limit(20);

        // 3. Apply filters based on condition
        if (miningCondition === 'aggro_top') {
            query = query.gte('f_aggro_score', 80);
        } else if (miningCondition === 'clean_unexpected') {
            query = query.lte('f_aggro_score', 20).order('f_aggro_score', { ascending: true });
        } else if (miningCondition === 'score_drop') {
            // This condition is more complex and will be implemented later.
            // For now, just return high score videos.
            query = query.gte('f_aggro_score', 70);
        }

        // Apply period filter
        if (period === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query = query.gte('f_created_at', today.toISOString());
        } else if (period === 'this_week') {
            const today = new Date();
            const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            firstDayOfWeek.setHours(0, 0, 0, 0);
            query = query.gte('f_created_at', firstDayOfWeek.toISOString());
        }

        // 4. Execute query
        const { data, error } = await query;

        if (error) {
            console.error('Error mining materials:', error);
            throw new Error(`Database query failed: ${error.message}`);
        }

        // 5. Format data
        const formattedData = data.map(item => ({
            id: item.f_id,
            score: item.f_aggro_score,
            // @ts-ignore
            title: item.t_videos?.f_title || '제목 없음',
            // @ts-ignore
            thumbnail_url: item.t_videos?.f_thumbnail_url || '',
            reason: miningCondition === 'aggro_top' ? `어그로 점수 상위` : `청정 채널 후보`
        }));

        return NextResponse.json(formattedData);

    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred during material mining.';
        console.error('Material mining error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
