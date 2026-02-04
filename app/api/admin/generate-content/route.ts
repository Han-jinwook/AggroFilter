import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

async function getMaterialData(supabase: any, materialId: number) {
    const { data, error } = await supabase
        .from('t_marketing_materials')
        .select(`
            f_source_video_id,
            t_videos:f_source_video_id (
                f_title,
                f_channel_title
            ),
            t_analysis_history:f_source_video_id (
                f_aggro_score,
                f_summary,
                f_evaluation_reason
            )
        `)
        .eq('f_id', materialId)
        .single();

    if (error) throw new Error(`Failed to fetch material data: ${error.message}`);
    if (!data) throw new Error('Material not found');

    // The query returns arrays, so we extract the first element.
    const analysis = Array.isArray(data.t_analysis_history) ? data.t_analysis_history[0] : data.t_analysis_history;
    const video = Array.isArray(data.t_videos) ? data.t_videos[0] : data.t_videos;

    return {
        video_title: video?.f_title,
        channel_title: video?.f_channel_title,
        aggro_score: analysis?.f_aggro_score,
        summary: analysis?.f_summary,
        reason: analysis?.f_evaluation_reason,
    };
}

function getAIPrompt(contentType: string, materialData: any) {
    const { video_title, channel_title, aggro_score, summary, reason } = materialData;

    switch (contentType) {
        case 'short-form':
            return `
                # 페르소나: 이슈를 파헤치는 팩트체크 전문 유튜버
                # 지시: 아래 '분석 데이터'를 바탕으로, 시청자의 호기심을 자극하는 60초 분량의 유튜브 쇼츠 대본을 작성해줘. 충격적인 반전을 제시하고, 사람들이 왜 이 영상에 속을 수밖에 없었는지 친절하게 설명해줘. 마지막에는 우리 앱 '어그로필터'를 자연스럽게 홍보해야 해.

                # 분석 데이터
                - 채널명: ${channel_title}
                - 영상 제목: ${video_title}
                - AI 분석 요약: ${summary}
                - AI 평가 이유: ${reason}
                - 어그로 점수: ${aggro_score}점

                # 대본 필수 구성 요소
                1. 오프닝 (3초): "유튜브 보다가 이런 영상 보신 적 있죠?" 같이 시청자의 공감을 사는 질문으로 시작.
                2. 문제 제기 (15초): 영상의 제목과 썸네일이 얼마나 자극적이었는지, 그래서 사람들이 무엇을 기대했는지 언급.
                3. 반전 공개 (15초): "그런데, 저희 AI가 분석해보니 결과는 충격적이었습니다." 라며 어그로 점수와 AI 분석 결과를 공개.
                4. 설명 (20초): AI가 왜 그런 점수를 줬는지, 영상의 어떤 부분이 시청자를 현혹했는지 1~2가지 포인트로 설명. (AI 평가 이유 활용)
                5. 클로징 (7초): "여러분이 보시는 영상, 믿을 수 있는지 궁금하다면? 지금 '어그로필터'에서 확인해보세요!" 라며 앱 다운로드 유도.

                # 출력 형식: (자막과 나레이션을 구분해서 작성)
                [자막] 시선 끄는 자막
                [나레이션] 귀에 쏙쏙 박히는 멘트
            `;
        case 'press-release':
             return `
                # 페르소나: 데이터 저널리스트
                # 지시: 아래 '분석 데이터'를 기반으로, 특정 유튜브 영상의 문제점을 심층적으로 분석하는 전문적인 보도자료 초안을 작성해줘. 데이터에 근거하여 객관적인 사실을 전달하되, 독자들이 문제의 심각성을 인지할 수 있도록 논리적으로 서술해야 해.

                # 분석 데이터
                - 채널명: ${channel_title}
                - 영상 제목: ${video_title}
                - AI 분석 요약: ${summary}
                - AI 평가 이유: ${reason}
                - 어그로 점수: ${aggro_score}점

                # 보도자료 필수 구성 요소
                1. 제목: 사실과 데이터를 담아 선정적이지 않으면서도 흥미를 끄는 제목.
                2. 리드 문단: 기사의 핵심 내용을 요약하여 제시.
                3. 본문: 
                    - (문제 제기) 해당 영상이 어떤 방식으로 시청자의 기대를 이용했는지 분석.
                    - (데이터 제시) '어그로필터' AI가 분석한 '어그로 점수'와 그 근거(AI 평가 이유)를 구체적으로 인용.
                    - (영향 분석) 이러한 콘텐츠가 유튜브 생태계와 시청자에게 미치는 부정적 영향 분석.
                4. 마무리: '어그로필터'의 역할을 간략히 소개하며, 건강한 미디어 소비 환경의 중요성을 강조하며 마무리.

                # 출력 형식: 언론사에 바로 배포할 수 있는 보도자료 형식.
            `;
        default:
            throw new Error('Invalid content type');
    }
}

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

    try {
        const { contentType, materialId } = await req.json();

        if (!contentType || !materialId) {
            return NextResponse.json({ error: 'contentType and materialId are required.' }, { status: 400 });
        }

        // 2. Fetch material data from DB
        const materialData = await getMaterialData(supabase, materialId);

        // 3. Construct AI prompt
        const prompt = getAIPrompt(contentType, materialData);

        // 4. Call AI to generate content
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            throw new Error("GOOGLE_API_KEY is not set");
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const result = await model.generateContent(prompt);
        const generatedContent = await result.response.text();

        // 5. Update the marketing material in the database
        const { error: updateError } = await supabase
            .from('t_marketing_materials')
            .update({ 
                f_generated_text: generatedContent,
                f_content_format: contentType === 'short-form' ? 'SHORTS' : (contentType === 'press-release' ? 'BLOG' : null),
                f_status: 'GENERATED'
            })
            .eq('f_id', materialId);

        if (updateError) {
            console.error('Error updating marketing material:', updateError);
            // Even if DB update fails, we can still return the content to the user
        }

        return NextResponse.json({ content: generatedContent });

    } catch (error) {
        console.error('Content generation error:', error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        return NextResponse.json({ error: `Failed to generate content: ${message}` }, { status: 500 });
    }
}
