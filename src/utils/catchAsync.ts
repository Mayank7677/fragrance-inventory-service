export const catchAsync = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    fn(req, res, next).catch(next);
  };
};



// example usage =>

// export const getUser = catchAsync(async (req, res, next) => {
//   const user = await User.findById(req.params.id);
//   if (!user) return 

//   res.status(200).json({ user });
// });