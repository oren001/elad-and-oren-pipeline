export type User = {
  id: string;
  display: string;
  handles: string[];
};

export const USERS: readonly User[] = [
  { id: "neta", display: "נטע", handles: ["נטע"] },
  { id: "itai", display: "איתי", handles: ["איתי"] },
  { id: "elad", display: "אלעד", handles: ["אלעד"] },
  { id: "philip", display: "פיליפ", handles: ["פיליפ"] },
  { id: "michal", display: "מיכל", handles: ["מיכל"] },
  { id: "oren", display: "אורן", handles: ["אורן"] },
  { id: "eran", display: "ערן", handles: ["ערן"] },
];

export function getUserById(id: string): User | undefined {
  return USERS.find((u) => u.id === id);
}

export function findMentions(text: string): User[] {
  const handleToUsers = new Map<string, User[]>();
  for (const u of USERS) {
    for (const h of u.handles) {
      const arr = handleToUsers.get(h) ?? [];
      arr.push(u);
      handleToUsers.set(h, arr);
    }
  }

  const matches = new Set<User>();
  let i = 0;
  while ((i = text.indexOf("@", i)) !== -1) {
    let bestHandle = "";
    let bestUsers: User[] = [];
    for (const [handle, users] of handleToUsers.entries()) {
      if (
        text.startsWith("@" + handle, i) &&
        handle.length > bestHandle.length
      ) {
        bestHandle = handle;
        bestUsers = users;
      }
    }
    if (bestHandle) {
      for (const u of bestUsers) matches.add(u);
      i += 1 + bestHandle.length;
    } else {
      i += 1;
    }
  }
  return [...matches];
}
