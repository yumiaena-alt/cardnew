import { desc, isNull } from 'drizzle-orm';
import { orgScoped } from '@/features/shared/orgScope';
import type { OrgScope } from '@/features/shared/scope';
import { db } from '@/libs/DB';
import type { BlogPost, NewBlogPost } from '@/models/Blog';
import { blogPosts } from '@/models/Blog';

/**
 * Blog draft access.
 *
 * Every read is tenant-filtered through `orgScoped()`, including the ones that
 * already hold an id: knowing a uuid is not the same as being allowed to read
 * what it points at.
 */

/**
 * Stores a draft.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param post - The draft to store, minus `orgId`.
 * @returns The stored draft.
 */
export async function insertBlogPost(
  scope: OrgScope,
  post: Omit<NewBlogPost, 'orgId'>,
): Promise<BlogPost> {
  const [row] = await db
    .insert(blogPosts)
    .values({ ...post, orgId: scope.orgId })
    .returning();

  if (!row) {
    throw new Error('Blog post insert returned no row');
  }

  return row;
}

/**
 * Lists the organization's drafts, newest first.
 *
 * @param scope - Tenant scope, or any object carrying the organization id.
 * @param limit - Most drafts to return.
 * @returns The drafts.
 */
export async function listBlogPosts(scope: OrgScope, limit = 50): Promise<BlogPost[]> {
  return await db
    .select()
    .from(blogPosts)
    .where(orgScoped(scope, blogPosts, isNull(blogPosts.deletedAt)))
    .orderBy(desc(blogPosts.createdAt))
    .limit(limit);
}
