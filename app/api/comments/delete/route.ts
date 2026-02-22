import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export async function DELETE(request: NextRequest) {
  try {
    const { commentId, userId } = await request.json()

    if (!commentId || !userId) {
      return NextResponse.json({ error: 'Missing commentId or userId' }, { status: 400 })
    }

    // Verify the user owns this comment
    const checkRes = await pool.query(
      `SELECT f_id 
       FROM t_comments
       WHERE f_id = $1 AND f_user_id = $2`,
      [commentId, userId]
    )

    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Comment not found or unauthorized' }, { status: 403 })
    }

    // Delete the comment (this will cascade delete replies if foreign key is set up)
    await pool.query('DELETE FROM t_comments WHERE f_id = $1', [commentId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete comment error:', error)
    return NextResponse.json({ 
      error: 'Failed to delete comment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
