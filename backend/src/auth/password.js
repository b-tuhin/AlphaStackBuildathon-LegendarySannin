import bcrypt from "bcryptjs";

export const hashPassword = (plain) => bcrypt.hashSync(plain, 10);
export const verifyPassword = (plain, hash) => !!hash && bcrypt.compareSync(plain, hash);
