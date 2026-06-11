export type SearchablePerson = {
  name?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  surname?: string | null;
  email?: string | null;
  staffId?: string | null;
} & Record<string, any>;

export function personHaystack(person: SearchablePerson | null | undefined, extra: (string | null | undefined)[] = []): string {
  if (!person) return extra.filter(Boolean).map(s => String(s).toLowerCase()).join(" ");
  const first = (person.firstName ?? "").toString().trim();
  const middle = (person.middleName ?? "").toString().trim();
  const surname = (person.surname ?? "").toString().trim();
  const composed = [first, middle, surname].filter(Boolean).join(" ");
  const reversed = [surname, first, middle].filter(Boolean).join(" ");
  const parts = [
    person.name,
    composed,
    reversed,
    first,
    middle,
    surname,
    person.email,
    person.staffId,
    ...extra,
  ].filter(Boolean).map(s => String(s).toLowerCase());
  return parts.join(" \u241F ");
}

export function matchesPerson(
  query: string,
  person: SearchablePerson | null | undefined,
  extra: (string | null | undefined)[] = []
): boolean {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return true;
  const hay = personHaystack(person, extra);
  return q.split(/\s+/).filter(Boolean).every(tok => hay.includes(tok));
}
