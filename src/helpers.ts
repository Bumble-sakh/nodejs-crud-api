import { UserData } from './store/store';

const isUserNameValid = (user: UserData) => {
  if (!user.username || typeof user.username !== 'string' || user.username.length <= 0) {
    return false;
  }

  return true;
};

const isAgeValid = (user: UserData) => {
  if (!user.age || typeof user.age !== 'number' || user.age < 0) {
    return false;
  }

  return true;
};

const isHobbiesValid = (user: UserData) => {
  if (
    !user.hobbies ||
    !Array.isArray(user.hobbies) ||
    user.hobbies.some((hobby) => typeof hobby !== 'string' || hobby.length <= 0)
  ) {
    return false;
  }

  return true;
};

export const isUserDataValid = (user: UserData) => {
  if (Object.keys(user).length !== 3) {
    return false;
  }

  return isUserNameValid(user) && isAgeValid(user) && isHobbiesValid(user);
};
