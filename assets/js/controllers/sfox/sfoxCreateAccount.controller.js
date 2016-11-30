angular
  .module('walletApp')
  .controller('SfoxCreateAccountController', SfoxCreateAccountController);

function SfoxCreateAccountController ($scope, $timeout, $q, Wallet, sfox, bcPhoneNumber) {
  let exchange = $scope.vm.exchange;
  let user = $scope.user = Wallet.user;

  let state = $scope.state = {
    terms: false,
    editEmail: false
  };

  $scope.format = bcPhoneNumber.format;

  $scope.setState = () => {
    state.email = user.email;
    state.mobile = user.mobileNumber;
    state.verifiedEmail = user.isEmailVerified;
    state.verifiedMobile = user.isMobileVerified;
    state.isVerified = state.verifiedEmail && state.verifiedMobile;
  };

  $scope.toggleEmail = () => {
    state.editEmail = !state.editEmail;
  };

  $scope.changeEmail = () => {
    $scope.lock();
    let email = state.email;
    state.editEmail = false;
    $q(Wallet.changeEmail.bind(null, email)).then($scope.setState).finally($scope.free);
  };

  $scope.changeMobile = () => {
    $scope.lock();
    state.sentCode = true;
    let mobile = state.mobile;
    $q(Wallet.changeMobile.bind(null, mobile)).then($scope.setState).finally($scope.free);
  };

  $scope.verifyMobile = () => {
    let code = state.confirmMobile;
    $q(Wallet.verifyMobile.bind(null, code)).then($scope.setState, sfox.displayError);
  };

  $scope.createAccount = () => {
    $scope.lock();
    $q.resolve(exchange.signup())
      .then(() => exchange.fetchProfile())
      .then(() => $scope.vm.goTo('verify'))
      .catch(sfox.displayError)
      .finally($scope.free);
  };

  $scope.$watch('user.isEmailVerified', $scope.setState);
  $scope.$watch('user.isMobileVerified', $scope.setState);
  $scope.$watch('state.mobile', () => $timeout(() => { state.sentCode = false; }));
  $scope.setState();
  $scope.installLock();
}