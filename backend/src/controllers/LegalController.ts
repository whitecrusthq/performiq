import { LegalDocument, TermsAcceptance } from "../models/index.js";

async function getOrCreateDoc(): Promise<LegalDocument> {
  let doc = await LegalDocument.findByPk(1);
  if (!doc) {
    doc = await LegalDocument.create({ id: 1 });
  }
  return doc;
}

export default class LegalController {
  /** Full document including drafts — admin only. */
  static async getAdmin() {
    const doc = await getOrCreateDoc();
    return {
      privacyContent: doc.privacyContent,
      privacyPublished: doc.privacyPublished,
      privacyUpdatedAt: doc.privacyUpdatedAt,
      termsContent: doc.termsContent,
      termsVersion: doc.termsVersion,
      termsPublished: doc.termsPublished,
      termsUpdatedAt: doc.termsUpdatedAt,
    };
  }

  /** Public privacy policy — only returns content when published. */
  static async getPublicPrivacy() {
    const doc = await getOrCreateDoc();
    if (!doc.privacyPublished) {
      return { published: false, content: "", updatedAt: null };
    }
    return { published: true, content: doc.privacyContent, updatedAt: doc.privacyUpdatedAt };
  }

  /** Public terms — only returns content when published. */
  static async getPublicTerms() {
    const doc = await getOrCreateDoc();
    if (!doc.termsPublished) {
      return { published: false, content: "", version: doc.termsVersion, updatedAt: null };
    }
    return { published: true, content: doc.termsContent, version: doc.termsVersion, updatedAt: doc.termsUpdatedAt };
  }

  static async updatePrivacy(input: { content: string; published: boolean }) {
    const doc = await getOrCreateDoc();
    await doc.update({
      privacyContent: input.content ?? "",
      privacyPublished: !!input.published,
      privacyUpdatedAt: new Date(),
      updatedAt: new Date(),
    });
    return LegalController.getAdmin();
  }

  /**
   * Save terms. The version is bumped (forcing all users to re-accept) whenever
   * published terms are saved with changed content, or when terms are published
   * for the first time. Editing an unpublished draft does not bump the version.
   */
  static async updateTerms(input: { content: string; published: boolean }) {
    const doc = await getOrCreateDoc();
    const content = input.content ?? "";
    const published = !!input.published;

    const contentChanged = content !== doc.termsContent;
    const newlyPublished = published && !doc.termsPublished;
    let version = doc.termsVersion;
    if (published && (contentChanged || newlyPublished || version === 0)) {
      version = doc.termsVersion + 1;
    }

    await doc.update({
      termsContent: content,
      termsPublished: published,
      termsVersion: version,
      termsUpdatedAt: new Date(),
      updatedAt: new Date(),
    });
    return LegalController.getAdmin();
  }

  /**
   * Whether a fully-authenticated user must accept the current terms before a
   * session is issued. Required only when terms are published (version > 0) and
   * the user has not yet accepted that exact version.
   */
  static async getTermsGateState(userId: number): Promise<{ required: boolean; version: number }> {
    const doc = await getOrCreateDoc();
    if (!doc.termsPublished || doc.termsVersion < 1) {
      return { required: false, version: doc.termsVersion };
    }
    const existing = await TermsAcceptance.findOne({
      where: { userId, version: doc.termsVersion },
    });
    return { required: !existing, version: doc.termsVersion };
  }

  static async recordAcceptance(userId: number, version: number, ip: string | null) {
    try {
      await TermsAcceptance.create({ userId, version, ipAddress: ip ?? null });
    } catch (err: any) {
      // Unique (user_id, version) — already accepted, treat as success (idempotent).
      if (err?.name !== "SequelizeUniqueConstraintError") throw err;
    }
  }

  /** Compliance indicator data for the logged-in user. */
  static async getMyAcceptance(userId: number) {
    const doc = await getOrCreateDoc();
    const currentVersion = doc.termsVersion;
    const published = doc.termsPublished;
    if (!published || currentVersion < 1) {
      return { accepted: true, version: null, acceptedAt: null, currentVersion, published };
    }
    const acc = await TermsAcceptance.findOne({
      where: { userId, version: currentVersion },
    });
    return {
      accepted: !!acc,
      version: acc ? acc.version : null,
      acceptedAt: acc ? acc.acceptedAt : null,
      currentVersion,
      published,
    };
  }
}
