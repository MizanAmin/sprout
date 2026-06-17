export type AuthUser = {
  id: string;
  nurseryId: number;
  role: 'manager' | 'staff' | 'parent';
  name: string;
  childIds: number[];
};

export type HonoEnv = {
  Variables: { user: AuthUser };
};
