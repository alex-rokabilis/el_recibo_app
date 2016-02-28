angular.module('PromotionList.controllers', [])
    .controller('PromotionsCtrl', function($scope, $ionicPlatform, api, $ionicPopup, User, $interval) {
        $scope.promotions = []
        $scope.$on('$ionicView.enter', function() {
            if (!User.get_token()) return;
            api.getPromotions().then(function(data) {
                $scope.promotions = data.all_proms
            })
        })


    })