// Offline base library: approximate values per 100 g, derived from USDA FoodData Central (SR Legacy, public domain) and typical German food-table values.
// Format: name|category|kcal|protein|carbs|fat|fiber|sugar|serving g|serving name
// Categories are internal keys (shown in English via the table in i18n.js); names and serving names are English.
const BASE_FOODS_RAW = `
Apple|Obst|52|0.3|14|0.2|2.4|10|180|1 apple
Banana|Obst|89|1.1|23|0.3|2.6|12|120|1 banana
Pear|Obst|57|0.4|15|0.1|3.1|10|180|1 pear
Orange|Obst|47|0.9|12|0.1|2.4|9|150|1 orange
Mandarin|Obst|53|0.8|13|0.3|1.8|11|70|1 mandarin
Grapefruit|Obst|42|0.8|11|0.1|1.6|7|250|1 grapefruit
Lemon|Obst|29|1.1|9|0.3|2.8|2.5|60|1 lemon
Strawberries|Obst|32|0.7|7.7|0.3|2|4.9|150|1 punnet
Raspberries|Obst|52|1.2|12|0.7|6.5|4.4|125|1 punnet
Blueberries|Obst|57|0.7|14|0.3|2.4|10|125|1 punnet
Blackberries|Obst|43|1.4|10|0.5|5.3|4.9|125|1 punnet
Red currants|Obst|56|1.4|14|0.2|4.3|7.4|100|
Cherries|Obst|63|1.1|16|0.2|2.1|13|150|1 handful
Grapes|Obst|69|0.7|18|0.2|0.9|16|150|1 punnet
Watermelon|Obst|30|0.6|7.6|0.2|0.4|6.2|300|1 piece
Honeydew melon|Obst|36|0.5|9.1|0.1|0.8|8.1|200|1 piece
Pineapple|Obst|50|0.5|13|0.1|1.4|10|150|1 serving
Mango|Obst|60|0.8|15|0.4|1.6|14|200|1 mango
Kiwi|Obst|61|1.1|15|0.5|3|9|75|1 kiwi
Peach|Obst|39|0.9|10|0.3|1.5|8.4|150|1 peach
Nectarine|Obst|44|1.1|11|0.3|1.7|7.9|140|1 nectarine
Apricot|Obst|48|1.4|11|0.4|2|9.2|35|1 apricot
Plum|Obst|46|0.7|11|0.3|1.4|9.9|30|1 plum
Pomegranate|Obst|83|1.7|19|1.2|4|14|100|
Avocado|Obst|160|2|8.5|15|6.7|0.7|150|1 avocado
Fig, fresh|Obst|74|0.8|19|0.3|2.9|16|50|1 fig
Dates, dried|Trockenobst|282|2.5|75|0.4|8|63|8|1 date
Raisins|Trockenobst|299|3.1|79|0.5|3.7|59|30|1 handful
Apricots, dried|Trockenobst|241|3.4|63|0.5|7.3|53|30|
Prunes|Trockenobst|240|2.2|64|0.4|7.1|38|30|
Cranberries, dried|Trockenobst|308|0.2|83|1.4|5.3|65|30|
Applesauce, unsweetened|Obst|42|0.2|11|0.1|1.1|9.4|100|
Tomato|Gemüse|18|0.9|3.9|0.2|1.2|2.6|120|1 tomato
Cherry tomatoes|Gemüse|18|0.9|3.9|0.2|1.2|2.6|100|
Cucumber|Gemüse|15|0.7|3.6|0.1|0.5|1.7|100|
Red bell pepper|Gemüse|31|1|6|0.3|2.1|4.2|150|1 pepper
Green bell pepper|Gemüse|20|0.9|4.6|0.2|1.7|2.4|150|1 pepper
Carrot|Gemüse|41|0.9|9.6|0.2|2.8|4.7|80|1 carrot
Broccoli|Gemüse|34|2.8|6.6|0.4|2.6|1.7|150|1 serving
Cauliflower|Gemüse|25|1.9|5|0.3|2|1.9|150|1 serving
Brussels sprouts|Gemüse|43|3.4|9|0.3|3.8|2.2|150|
Kale|Gemüse|49|4.3|8.8|0.9|3.6|2.3|150|
White cabbage|Gemüse|25|1.3|5.8|0.1|2.5|3.2|150|
Red cabbage|Gemüse|31|1.4|7.4|0.2|2.1|3.8|150|
Sauerkraut|Gemüse|19|0.9|4.3|0.1|2.9|1.8|150|
Spinach|Gemüse|23|2.9|3.6|0.4|2.2|0.4|100|
Lamb's lettuce|Gemüse|21|2|3.6|0.4|1.5|0.5|50|
Butterhead lettuce|Gemüse|15|1.4|2.9|0.2|1.3|0.8|50|
Iceberg lettuce|Gemüse|14|0.9|3|0.1|1.2|2|50|
Arugula|Gemüse|25|2.6|3.7|0.7|1.6|2|30|
Zucchini|Gemüse|17|1.2|3.1|0.3|1|2.5|200|1 zucchini
Eggplant|Gemüse|25|1|5.9|0.2|3|3.5|250|1 eggplant
Onion|Gemüse|40|1.1|9.3|0.1|1.7|4.2|80|1 onion
Garlic|Gemüse|149|6.4|33|0.5|2.1|1|4|1 clove
Leek|Gemüse|61|1.5|14|0.3|1.8|3.9|100|
Spring onions|Gemüse|32|1.8|7.3|0.2|2.6|2.3|15|
Button mushrooms|Gemüse|22|3.1|3.3|0.3|1|2|100|
Mixed mushrooms|Gemüse|28|2.5|4.5|0.4|2|1.5|100|
Green peas|Gemüse|81|5.4|14|0.4|5.7|5.7|100|
Green beans|Gemüse|31|1.8|7|0.2|2.7|3.3|150|
Sweet corn (canned)|Gemüse|86|3.3|19|1.4|2|3.2|80|
Hokkaido pumpkin|Gemüse|40|1.7|8.3|0.6|2.5|3|200|
Sweet potato|Gemüse|86|1.6|20|0.1|3|4.2|200|1 sweet potato
Potatoes, boiled|Beilagen|87|1.9|20|0.1|1.8|0.9|200|1 serving
Potatoes, raw|Gemüse|77|2|17|0.1|2.2|0.8|200|
Beetroot|Gemüse|43|1.6|9.6|0.2|2.8|6.8|100|
Celery (stalk)|Gemüse|16|0.7|3|0.2|1.6|1.3|40|1 stalk
White asparagus|Gemüse|18|1.9|2|0.1|1.5|1.8|250|
Green asparagus|Gemüse|20|2.2|3.9|0.1|2.1|1.9|200|
Radishes|Gemüse|16|0.7|3.4|0.1|1.6|1.9|50|
Kohlrabi|Gemüse|27|1.7|6.2|0.1|3.6|2.6|150|
Fennel|Gemüse|31|1.2|7.3|0.2|3.1|3.9|150|
Green olives|Gemüse|145|1|3.8|15|3.3|0.5|30|
Black olives|Gemüse|115|0.8|6|11|3.2|0|30|
Pickles|Gemüse|12|0.5|2.3|0.2|1|1.3|50|
Passata (strained tomatoes)|Gemüse|32|1.4|6|0.2|1.5|4|100|
Tomato paste|Gemüse|82|4.3|19|0.5|4.1|12|20|1 tbsp
Rolled oats|Getreide|372|13.5|59|7|10|1|50|1 serving
Muesli, unsweetened|Getreide|360|10|62|6|8|12|50|1 serving
Cornflakes|Getreide|378|7|84|0.9|3.3|8|30|1 serving
Granola|Getreide|471|10|64|20|5|25|50|1 serving
White rice, raw|Getreide|360|6.7|79|0.6|1.3|0.1|75|1 serving, raw
White rice, cooked|Beilagen|130|2.7|28|0.3|0.4|0.1|200|1 serving
Brown rice, raw|Getreide|362|7.5|76|2.7|3.4|0.9|75|
Brown rice, cooked|Beilagen|123|2.7|26|1|1.6|0.2|200|
Basmati rice, cooked|Beilagen|121|3.5|25|0.4|0.4|0|200|
Pasta, raw|Getreide|359|12.5|72|1.5|3|3|100|1 serving, raw
Pasta, cooked|Beilagen|158|5.8|31|0.9|1.8|0.6|250|1 serving
Whole-wheat pasta, raw|Getreide|348|14|65|2.5|9|3|100|
Whole-wheat pasta, cooked|Beilagen|149|6|30|1.7|3.9|0.8|250|
Couscous, raw|Getreide|376|12.8|77|0.6|5|0|75|
Couscous, cooked|Beilagen|112|3.8|23|0.2|1.4|0.1|200|
Bulgur, raw|Getreide|342|12.3|76|1.3|12.5|0.4|75|
Quinoa, raw|Getreide|368|14|64|6.1|7|0|75|
Quinoa, cooked|Beilagen|120|4.4|21|1.9|2.8|0.9|185|
Millet, raw|Getreide|378|11|73|4.2|8.5|1.7|75|
Buckwheat, raw|Getreide|343|13|72|3.4|10|0|75|
Wheat flour (all-purpose)|Getreide|364|10|76|1|2.7|0.3|100|
Whole-wheat flour|Getreide|340|13|72|2.5|10.7|0.4|100|
Semolina|Getreide|360|12.7|73|1.1|3.9|0|50|
Sandwich bread|Brot|265|9|49|3.2|2.7|5|28|1 slice
Whole-wheat sandwich bread|Brot|247|13|41|3.4|7|6|30|1 slice
Wheat roll|Brot|276|9.4|54|1.9|3|3|55|1 roll
Whole-wheat roll|Brot|250|10|44|3.5|7|3|60|1 roll
Mixed rye-wheat bread|Brot|228|6.5|46|1.3|5|2|50|1 slice
Whole-grain bread|Brot|214|7|39|1.6|8|2|50|1 slice
Rye bread|Brot|224|6.5|45|1.2|7|2|50|1 slice
Pumpernickel|Brot|190|5|38|1|9|2|40|1 slice
Baguette|Brot|272|9|55|1.8|2.4|3|60|1 piece
Pretzel|Brot|270|8|55|2|2|1|80|1 pretzel
Croissant|Brot|406|8.2|46|21|2.6|11|60|1 croissant
Crispbread|Brot|366|9|69|3|16|2|10|1 slice
Rice cake|Brot|387|8|81|2.8|4|0.8|8|1 waffle
Flour tortilla|Brot|306|8|50|8|3.5|2|40|1 wrap
Flatbread|Brot|275|9|55|1.2|2.2|1|100|
Whole milk 3.5%|Milchprodukte|64|3.3|4.8|3.5|0|4.8|250|1 glass
Low-fat milk 1.5%|Milchprodukte|47|3.4|4.9|1.5|0|4.9|250|1 glass
Skim milk|Milchprodukte|35|3.4|5|0.1|0|5|250|1 glass
Oat milk|Milchprodukte|46|0.8|6.7|1.5|0.8|4|250|1 glass
Soy milk, unsweetened|Milchprodukte|33|3.3|0.6|1.8|0.5|0.3|250|1 glass
Almond milk, unsweetened|Milchprodukte|15|0.5|0.3|1.1|0.3|0|250|1 glass
Yogurt 3.5%|Milchprodukte|61|3.5|4|3.5|0|4|150|1 tub
Yogurt 1.5%|Milchprodukte|47|3.8|4.5|1.5|0|4.5|150|1 tub
Greek yogurt 10%|Milchprodukte|133|5|4|10|0|4|150|
Skyr|Milchprodukte|63|11|4|0.2|0|4|150|1 serving
Low-fat quark|Milchprodukte|67|12|4|0.3|0|4|250|1 pack
Quark 20%|Milchprodukte|109|11|3|5|0|3|250|
Cottage cheese|Milchprodukte|98|11|3.4|4.3|0|2.7|200|1 tub
Buttermilk|Milchprodukte|37|3.3|4|0.5|0|4|250|1 glass
Kefir|Milchprodukte|55|3.3|4|3|0|4|250|1 glass
Heavy cream 30%|Milchprodukte|292|2.4|3.2|30|0|3.2|30|
Sour cream|Milchprodukte|115|3|4|10|0|4|30|
Crème fraîche|Milchprodukte|292|2.4|2.8|30|0|2.8|30|
Gouda|Käse|356|25|2.2|27|0|2.2|30|1 slice
Emmental|Käse|380|28|0|30|0|0|30|1 slice
Edam|Käse|357|25|1.4|28|0|1.4|30|1 slice
Mozzarella|Käse|254|18|1|19|0|1|125|1 scoop
Mozzarella, light|Käse|165|19|1|9|0|1|125|1 scoop
Feta|Käse|264|14|4|21|0|4|50|
Parmesan|Käse|431|38|4|29|0|0.9|10|1 tbsp
Camembert|Käse|300|20|0.5|24|0|0.5|30|
Cream cheese|Käse|342|6|4|34|0|3.2|30|
Cream cheese, light|Käse|150|8|5|11|0|4|30|
Shepherd's cheese|Käse|250|17|1|20|0|1|50|
Harz cheese (sour milk cheese)|Käse|117|28|0|0.7|0|0|50|
Halloumi|Käse|321|21|2|25|0|2|50|
Butter|Fette|717|0.9|0.1|81|0|0.1|10|1 serving
Margarine|Fette|717|0.2|0.7|80|0|0|10|
Olive oil|Fette|884|0|0|100|0|0|10|1 tbsp
Canola oil|Fette|884|0|0|100|0|0|10|1 tbsp
Sunflower oil|Fette|884|0|0|100|0|0|10|1 tbsp
Coconut oil|Fette|862|0|0|100|0|0|10|1 tbsp
Mayonnaise|Fette|680|1|0.6|75|0|0.6|15|1 tbsp
Egg|Eier|143|12.6|0.7|9.5|0|0.4|60|1 egg (M)
Egg white|Eier|52|10.9|0.7|0.2|0|0.7|33|1 egg white
Egg yolk|Eier|322|16|3.6|27|0|0.6|17|1 egg yolk
Scrambled eggs|Eier|149|10|1.6|11|0|1.4|120|
Chicken breast, raw|Fleisch|110|23|0|1.2|0|0|150|1 fillet
Chicken breast, cooked|Fleisch|165|31|0|3.6|0|0|150|1 fillet
Chicken thigh|Fleisch|177|19|0|11|0|0|150|
Turkey breast, raw|Fleisch|104|24|0|1|0|0|150|
Turkey breast, sliced deli|Wurst|104|20|1|2|0|1|20|1 slice
Ground beef|Fleisch|254|17|0|20|0|0|125|
Lean ground beef (5%)|Fleisch|137|21|0|5|0|0|125|
Ground beef and pork|Fleisch|260|18|0|21|0|0|125|
Beef steak|Fleisch|180|26|0|8.5|0|0|200|1 steak
Beef tenderloin|Fleisch|143|22|0|6|0|0|180|
Pork tenderloin|Fleisch|122|21|0|4|0|0|150|
Pork cutlet|Fleisch|125|22|0|4|0|0|150|
Pork shoulder|Fleisch|220|18|0|16|0|0|150|
Lamb|Fleisch|282|17|0|23|0|0|150|
Bacon|Wurst|541|37|1.4|42|0|0|30|
Cooked ham|Wurst|108|19|1|3|0|1|20|1 slice
Cured ham|Wurst|250|26|0|16|0|0|20|1 slice
Salami|Wurst|380|22|1|32|0|1|10|1 slice
Frankfurters|Wurst|260|13|1|23|0|1|50|1 sausage
Bratwurst|Wurst|300|13|1|27|0|0.5|100|1 bratwurst
Liver sausage|Wurst|326|14|2|29|0|1|20|
Bologna-style sausage|Wurst|285|12|1|26|0|0.5|30|
Salmon|Fisch|208|20|0|13|0|0|125|1 fillet
Smoked salmon|Fisch|117|18|0|4.3|0|0|50|
Tuna (canned in water)|Fisch|116|26|0|1|0|0|130|1 can
Tuna (canned in oil)|Fisch|198|29|0|8|0|0|130|1 can
Cod|Fisch|82|18|0|0.7|0|0|150|
Pollock|Fisch|92|19|0|1|0|0|150|
Trout|Fisch|119|20|0|3.5|0|0|150|
Herring|Fisch|158|18|0|9|0|0|100|
Mackerel|Fisch|205|19|0|14|0|0|100|
Shrimp|Fisch|85|20|0|0.5|0|0|100|
Fish sticks|Fisch|220|12|19|10|1|1|30|1 stick
Sardines in oil|Fisch|208|25|0|11|0|0|90|
Lentils, raw|Hülsenfrüchte|352|25|60|1.1|11|2|60|
Lentils, cooked|Hülsenfrüchte|116|9|20|0.4|7.9|1.8|200|
Red lentils, raw|Hülsenfrüchte|358|24|63|2.2|11|2|60|
Chickpeas, cooked|Hülsenfrüchte|164|8.9|27|2.6|7.6|4.8|150|
Kidney beans, cooked|Hülsenfrüchte|127|8.7|23|0.5|6.4|0.3|150|
White beans, cooked|Hülsenfrüchte|139|9.7|25|0.4|6.3|0.3|150|
Black beans, cooked|Hülsenfrüchte|132|8.9|24|0.5|8.7|0.3|150|
Edamame|Hülsenfrüchte|121|12|9|5|5|2|100|
Tofu, plain|Hülsenfrüchte|144|15|3|8.7|2.3|0.6|100|
Smoked tofu|Hülsenfrüchte|170|17|2|10|2|1|100|
Tempeh|Hülsenfrüchte|192|20|7.6|11|0|0|100|
Hummus|Hülsenfrüchte|166|7.9|14|9.6|6|0.3|50|
Soy chunks, dry|Hülsenfrüchte|330|50|20|1.5|18|8|50|
Almonds|Nüsse|579|21|22|50|12.5|4.4|30|1 handful
Walnuts|Nüsse|654|15|14|65|6.7|2.6|30|1 handful
Hazelnuts|Nüsse|628|15|17|61|9.7|4.3|30|1 handful
Cashews|Nüsse|553|18|30|44|3.3|5.9|30|1 handful
Peanuts|Nüsse|567|26|16|49|8.5|4|30|1 handful
Peanuts, roasted and salted|Nüsse|599|28|15|52|8|4|30|
Pistachios|Nüsse|560|20|28|45|10.6|7.7|30|
Brazil nuts|Nüsse|659|14|12|67|7.5|2.3|30|
Macadamia nuts|Nüsse|718|7.9|14|76|8.6|4.6|30|
Peanut butter|Nüsse|588|25|20|50|6|9|15|1 tbsp
Almond butter|Nüsse|614|21|19|56|10|4.4|15|1 tbsp
Chia seeds|Nüsse|486|17|42|31|34|0|15|1 tbsp
Flaxseed|Nüsse|534|18|29|42|27|1.6|10|1 tbsp
Sunflower seeds|Nüsse|584|21|20|51|8.6|2.6|20|
Pumpkin seeds|Nüsse|559|30|11|49|6|1.4|20|
Sesame seeds|Nüsse|573|18|23|50|12|0.3|10|
Shredded coconut|Nüsse|660|6.9|24|65|16|7.4|10|
Sugar|Süßes|387|0|100|0|0|100|5|1 tsp
Honey|Süßes|304|0.3|82|0|0.2|82|20|1 tbsp
Maple syrup|Süßes|260|0|67|0.1|0|60|20|1 tbsp
Jam|Süßes|250|0.4|62|0.1|1|50|20|1 tbsp
Chocolate hazelnut spread|Süßes|539|6.3|57|31|3.4|56|15|1 tbsp
Milk chocolate|Süßes|535|7.7|59|30|3.4|52|25|1 bar
Dark chocolate 70%|Süßes|598|7.8|46|43|11|24|25|
Gummy bears|Süßes|343|6.9|77|0.1|0|46|25|1 handful
Butter biscuits|Süßes|440|7.5|72|12|2.5|23|8|1 cookie
Chocolate cookies|Süßes|490|5.5|65|23|3|33|12|1 cookie
Chocolate croissant|Süßes|420|7|48|22|2.5|17|70|
Muffin|Süßes|377|5|53|16|1.5|30|80|1 muffin
Donut|Süßes|421|5|50|23|1.3|22|60|1 donut
Cheesecake|Süßes|260|7|23|15|0.3|17|120|1 piece
Apple strudel|Süßes|274|3|41|11|2|20|120|1 piece
Vanilla ice cream|Süßes|207|3.5|24|11|0.7|21|100|1 scoop ≈ 60 g
Chocolate pudding|Süßes|112|3.3|18|3|0.5|14|125|1 tub
Granola bar|Süßes|420|6|65|14|5|28|25|1 bar
Protein bar|Süßes|360|33|35|11|5|3|60|1 bar
Potato chips|Snacks|536|7|53|35|4.4|0.4|30|1 handful
Pretzel sticks|Snacks|380|10|78|2.5|3|2|30|
Popcorn, salted|Snacks|500|9|55|28|10|1|30|
Tortilla chips|Snacks|489|7|63|23|5|1|30|
Trail mix|Snacks|480|13|45|28|6|30|30|1 handful
Whey protein powder|Supplemente|380|78|7|5|0|5|30|1 scoop
Vegan protein powder|Supplemente|380|75|8|6|5|2|30|1 scoop
Creatine|Supplemente|0|0|0|0|0|0|5|
Water|Getränke|0|0|0|0|0|0|250|1 glass
Coffee, black|Getränke|2|0.1|0|0|0|0|200|1 cup
Cappuccino|Getränke|35|2|3|1.8|0|3|200|1 cup
Latte macchiato|Getränke|48|2.6|3.8|2.5|0|3.8|300|1 glass
Tea, unsweetened|Getränke|1|0|0.2|0|0|0|250|1 cup
Orange juice|Getränke|45|0.7|10|0.2|0.2|8.4|250|1 glass
Apple juice|Getränke|46|0.1|11|0.1|0.2|10|250|1 glass
Apple juice spritzer|Getränke|24|0|5.5|0|0|5.5|330|1 glass
Cola|Getränke|42|0|10.6|0|0|10.6|330|1 can
Cola zero|Getränke|0.3|0|0|0|0|0|330|1 can
Lemonade|Getränke|40|0|10|0|0|10|330|
Iced tea|Getränke|30|0|7.5|0|0|7.5|330|
Energy drink|Getränke|45|0|11|0|0|11|250|1 can
Beer (pilsner)|Getränke|42|0.5|3|0|0|0|500|1 bottle 0.5 l
Beer, non-alcoholic|Getränke|26|0.4|5.5|0|0|3|500|1 bottle 0.5 l
White wine, dry|Getränke|82|0.1|2.6|0|0|1|200|1 glass
Red wine, dry|Getränke|85|0.1|2.6|0|0|0.6|200|1 glass
Sparkling wine|Getränke|80|0.2|3|0|0|2|100|1 glass
Fruit smoothie|Getränke|55|0.6|12|0.2|1.2|10|250|
Ketchup|Saucen|112|1.2|26|0.1|0.3|22|15|1 tbsp
Mustard|Saucen|66|4|5.3|3.3|3.3|0.9|10|1 tsp
Soy sauce|Saucen|53|8|4.9|0.6|0.8|0.4|15|1 tbsp
Pesto (Genovese)|Saucen|480|5|6|48|2|2|30|
Tomato sauce (jarred)|Saucen|50|1.5|8|1.2|1.5|6|125|
Balsamic vinegar|Saucen|88|0.5|17|0|0|15|10|1 tbsp
Salad dressing (yogurt)|Saucen|150|1.5|8|12|0|6|30|
BBQ sauce|Saucen|172|0.8|41|0.6|0.9|33|20|
Gravy|Saucen|50|1.5|7|1.5|0|1|60|
Pizza Margherita|Gerichte|250|10|31|9.5|2|3.5|350|1 pizza (half ≈ 175 g)
Pizza salami|Gerichte|275|11|29|13|2|3|350|
Frozen pizza|Gerichte|240|10|28|9|2|3|350|1 pizza
Spaghetti Bolognese|Gerichte|145|7.5|17|5|1.5|2.5|400|1 plate
Spaghetti carbonara|Gerichte|210|9|22|10|1|1|400|1 plate
Lasagna|Gerichte|165|9|14|8|1.2|3|350|1 serving
Pasta salad|Gerichte|200|4|20|12|1.5|3|200|
Potato salad (mayo)|Gerichte|170|2.5|13|12|1.5|2|200|
Potato salad (vinegar and oil)|Gerichte|110|2|15|5|1.5|1.5|200|
Fried potatoes|Gerichte|150|2.5|20|7|2|0.5|250|
French fries|Gerichte|312|3.4|41|15|3.8|0.3|150|1 serving
Mashed potatoes|Gerichte|88|2|13|3.2|1.2|1.5|200|
Croquettes|Gerichte|210|3|28|9|2.5|1|120|
Wiener schnitzel|Gerichte|235|17|13|13|0.6|0.5|180|1 cutlet
Currywurst with sauce|Gerichte|230|10|10|17|0.5|8|200|
Doner kebab|Gerichte|215|11|20|10|1.5|2.5|350|1 doner
Falafel|Gerichte|333|13|32|18|5|1|100|
Hamburger|Gerichte|254|13|28|10|1.5|5|130|1 burger
Cheeseburger|Gerichte|263|14|26|12|1.5|6|140|1 burger
Chicken nuggets|Gerichte|296|15|17|19|1|0.5|100|about 6 pieces
Sushi maki (salmon)|Gerichte|150|5.8|28|1.5|0.8|5|25|1 piece
Chili con carne|Gerichte|110|8|9|4.5|3.5|2.5|400|1 plate
Goulash|Gerichte|120|13|4|6|0.5|2|300|
Chicken fricassee|Gerichte|130|11|5|7|0.5|1|300|
Beef roulade|Gerichte|170|20|3|9|0.5|1.5|200|
Meatball (Frikadelle)|Gerichte|245|15|9|17|0.5|1|100|1 meatball
Cheese spaetzle|Gerichte|230|10|23|11|1.2|1|350|
Maultaschen (stuffed pasta)|Gerichte|190|8|25|6|1.5|1.5|200|
Vegetable stir-fry|Gerichte|70|2.5|8|3|2.5|4|300|
Vegetable curry with coconut milk|Gerichte|105|2.5|8|7|2.5|3.5|350|
Chicken curry|Gerichte|130|11|5|7.5|1|2.5|350|
Fried rice|Gerichte|170|5|26|5.5|1|1|300|
Fried noodles|Gerichte|175|6|24|6|1.5|2|300|
Scrambled eggs with bacon|Gerichte|215|14|1|17|0|0.8|150|
Omelet|Gerichte|154|11|0.6|12|0|0.4|150|
Pancakes|Gerichte|227|6.4|28|10|0.9|5|80|1 pancake
Waffle|Gerichte|291|7.9|33|14|1.4|7|75|1 waffle
Porridge with milk|Gerichte|100|4|14|3|1.5|5|300|1 punnet
Lentil soup|Gerichte|75|5|10|1.5|3|1.5|400|1 plate
Tomato soup|Gerichte|45|1|7|1.5|0.8|4.5|300|1 plate
Potato soup|Gerichte|65|2|9|2.5|1|1|400|1 plate
Chicken soup|Gerichte|40|3|4|1.3|0.3|0.5|400|1 plate
Pea stew|Gerichte|90|6|10|3|3.5|1.5|400|
Caesar salad|Gerichte|130|7|6|9|1.5|1.5|250|
Greek salad|Gerichte|105|3.5|4.5|8.5|1.5|2.5|250|
Mixed salad (no dressing)|Gerichte|17|1.2|3|0.2|1.6|1.5|150|
Chicken wrap|Gerichte|200|11|20|8|2|2|250|
Cheese sandwich roll|Gerichte|280|12|30|12|2|2|100|
Ham sandwich roll|Gerichte|240|12|31|7|2|2|100|
Bowl (rice, chicken, vegetables)|Gerichte|140|9|17|4|2|2|450|1 bowl
Burrito|Gerichte|190|8|23|7|3|1.5|300|
Tacos|Gerichte|226|9|20|12|3|1.5|80|1 taco
Risotto|Gerichte|150|4|22|5|0.8|0.8|300|
Ratatouille|Gerichte|60|1.3|6|3.5|2|4|250|
Roasted vegetables|Gerichte|85|1.8|9|4.5|3|4|300|
Leberkäse (meatloaf)|Wurst|297|12|3|26|0|1|100|1 slice
Weisswurst (white sausage)|Wurst|285|11|1|26|0|0.5|80|1 weisswurst
Mortadella|Wurst|311|15|1|28|0|1|20|1 slice
Turkey frankfurters|Wurst|180|14|1|13|0|1|50|1 sausage
Chorizo|Wurst|455|24|2|38|0|1|20|
Chicken breast, sliced deli|Wurst|100|21|1|1.5|0|1|20|1 slice
Rump steak|Fleisch|136|23|0|4.5|0|0|200|1 steak
Chicken wings|Fleisch|203|18|0|14|0|0|100|
Meatloaf|Gerichte|210|15|7|14|0.5|1.5|150|1 slice
Roast pork|Gerichte|200|25|1|11|0|0|150|1 serving
Sauerbraten (marinated pot roast)|Gerichte|160|22|6|5|0.5|4|200|
Smoked pork chop (Kassler)|Fleisch|160|21|0.5|8|0|0.5|150|
Doner plate|Gerichte|180|12|14|8|1.5|2|450|1 plate
Dürüm wrap|Gerichte|220|11|22|10|2|2|350|1 wrap
Lahmacun|Gerichte|210|9|30|6|2|2|200|1 piece
Flammkuchen (tarte flambée)|Gerichte|260|8|26|14|1.5|2|300|
Spaetzle|Beilagen|155|5.5|28|2.2|1.5|0.5|200|1 serving
Bread dumpling|Beilagen|190|6|33|3.5|2|2|120|1 dumpling
Potato dumpling|Beilagen|115|2|24|1|2|0.5|120|1 dumpling
Gnocchi|Beilagen|150|3.5|32|0.5|1.5|0.5|200|1 serving
Schupfnudeln (potato noodles)|Beilagen|170|4|33|2|2|0.5|200|
Potato pancakes|Gerichte|220|3|25|12|3|1|100|1 piece
Red cabbage (jarred)|Gemüse|60|1.2|12|0.5|2|10|150|
Baked potato|Beilagen|93|2.5|21|0.1|2.2|1.2|250|1 potato
Potato gratin|Gerichte|130|4|11|8|1|1.5|250|
Rice with vegetables|Gerichte|120|3|22|2|1.5|1.5|300|
Udon noodles, cooked|Beilagen|105|2.6|21|0.4|1|0.3|200|
Rice noodles, cooked|Beilagen|108|1.8|24|0.2|1|0|200|
Glass noodles, cooked|Beilagen|90|0.1|22|0.1|0.5|0|150|
Ramen (instant)|Gerichte|440|9|60|18|2.5|2|80|1 pack
Pho|Gerichte|60|4.5|7|1.5|0.5|0.8|500|1 punnet
Pad Thai|Gerichte|175|8|22|6|1.5|5|350|
Sushi nigiri (salmon)|Gerichte|170|8|25|3.5|0.3|5|35|1 piece
Poke bowl|Gerichte|140|8|18|4|2|3|450|1 bowl
Butter chicken|Gerichte|150|11|5|9.5|1|3|350|
Paella|Gerichte|155|8|20|4.5|1|1|350|
Shakshuka|Gerichte|90|5.5|6|5|1.5|4|300|
Moussaka|Gerichte|140|7|9|8.5|2|3.5|350|
Gyros|Gerichte|230|19|3|16|0.5|1|200|
Tzatziki|Saucen|110|4|4|8.5|0.3|3.5|50|
Tahini|Nüsse|595|17|21|54|9|0.5|15|1 tbsp
Guacamole|Saucen|155|2|8.5|13|6|1|50|
Salsa|Saucen|36|1.5|7|0.2|1.8|4|50|
Aioli|Saucen|640|1|3|70|0|1|15|1 tbsp
Remoulade|Saucen|500|1|8|52|0|6|20|
Hollandaise|Saucen|490|3|5|51|0|1.5|30|
Curry sauce|Saucen|110|1|20|3|1|17|30|
Sweet and sour sauce|Saucen|150|0.4|36|0.2|0.4|30|30|
Ajvar|Saucen|80|1.4|9|4|2|7|30|
Herb butter|Fette|630|1|2|69|0|1|10|
Ghee|Fette|900|0|0|100|0|0|10|1 tbsp
Flaxseed oil|Fette|884|0|0|100|0|0|10|1 tbsp
Beef broth|Getränke|5|0.6|0.2|0.2|0|0|250|1 cup
Vegetable broth|Getränke|6|0.3|1|0.1|0|0.5|250|1 cup
Protein shake with milk|Getränke|85|10|5.5|2.5|0|5.5|330|1 shake
Protein pudding|Milchprodukte|80|10|6|1.5|0.5|4|200|1 tub
Protein yogurt|Milchprodukte|60|10|4|0.2|0|4|200|1 tub
Skyr, vanilla|Milchprodukte|75|9|8|0.2|0|8|150|
Fruit yogurt|Milchprodukte|95|3.2|14|2.8|0.2|13|150|1 tub
Semolina pudding|Milchprodukte|105|3.5|16|3|0.2|10|150|1 tub
Rice pudding|Milchprodukte|115|3.3|19|2.8|0.3|9|200|1 tub
Cocoa (with milk)|Getränke|80|3.5|10|3|0.5|9.5|250|1 cup
Hot chocolate powder|Süßes|380|5|80|3|6|75|15|1 tbsp
Ayran|Milchprodukte|35|1.7|2.6|1.8|0|2.6|250|1 glass
Burrata|Käse|330|17|1|29|0|1|125|1 scoop
Ricotta|Käse|174|11|3|13|0|0.3|50|
Mascarpone|Käse|429|4.6|4|44|0|3.5|30|
Mountain cheese|Käse|400|29|0|32|0|0|30|1 slice
Butterkäse (mild cheese)|Käse|340|21|0|28|0|0|30|1 slice
Sliced cheese, light|Käse|260|30|0|16|0|0|25|1 slice
Processed cheese|Käse|260|11|6|21|0|5|20|1 wedge
Grilling cheese|Käse|320|21|1|26|0|1|100|
Vegan cheese|Käse|280|1|21|22|0|0|25|1 slice
Tofu sausage|Hülsenfrüchte|220|16|5|15|2|1|50|
Vegan burger patty|Hülsenfrüchte|230|17|6|15|3|1|113|1 patty
Seitan|Hülsenfrüchte|370|75|14|1.9|0.6|0|100|
Pea protein mince|Hülsenfrüchte|200|17|4|12|3|0.5|125|
Oat bran|Getreide|246|17|66|7|15|1.5|30|
Spelt flakes|Getreide|355|13|64|2.5|9|1.5|50|
Puffed rice|Getreide|380|7|84|1|1.5|0.5|20|
Chocolate muesli|Getreide|430|8.5|65|14|7|20|50|1 serving
Overnight oats|Gerichte|130|5|18|4|2.5|6|300|1 glass
Pretzel roll|Brot|265|9|51|2.5|2.5|1|80|1 piece
Spelt bread|Brot|240|8|44|2|5|2|50|1 slice
Seeded roll|Brot|285|11|42|7|6|2|70|1 roll
Ciabatta|Brot|271|9|51|3|2.3|2|80|
Bagel|Brot|257|10|50|1.5|2.2|5|90|1 bagel
Burger bun|Brot|280|9|49|5|2.4|6|60|1 roll
Pita|Brot|275|9|56|1.2|2.2|1.3|60|1 pita
Braided sweet bread|Süßes|330|8|52|9|2|14|50|1 slice
Berliner (jelly donut)|Süßes|370|6|47|17|1.5|17|80|1 donut
Franzbrötchen (cinnamon pastry)|Süßes|400|6|48|20|1.5|18|90|1 piece
Crumb cake|Süßes|390|5|52|18|1.3|25|100|1 piece
Black Forest cake|Süßes|260|4|28|14|1|20|120|1 piece
Marble cake|Süßes|400|6|50|19|1.2|28|70|1 piece
Brownie|Süßes|466|6|50|27|2.5|36|60|1 brownie
Tiramisu|Süßes|280|5|28|16|0.5|22|120|1 serving
Lebkuchen (gingerbread)|Süßes|380|5|72|7|3|45|25|1 piece
Spekulatius (spiced cookies)|Süßes|480|6|70|19|2|32|10|1 cookie
Marzipan|Süßes|470|8|56|24|5|50|25|
Chocolate bar (Snickers-style)|Süßes|488|8.6|60|24|2.3|50|50|1 bar
Chocolate wafer bar (KitKat-style)|Süßes|518|6.5|61|27|2|48|42|1 bar
Fruit gums, vegan|Süßes|330|0.5|80|0.2|0.5|50|25|
Licorice|Süßes|375|3.5|83|2|1|40|25|
Ice cream bar (chocolate)|Süßes|290|3.5|27|19|1|24|70|1 piece
Sorbet|Süßes|130|0.3|32|0|0.5|28|100|1 scoop
Frozen yogurt|Süßes|160|4|30|3|0|26|100|
Peanut puffs|Snacks|550|14|52|32|4|2|30|
Rice crackers|Snacks|390|7|83|2|1|2|25|
Vegetable chips|Snacks|500|4|55|30|10|20|30|
Beef jerky|Snacks|300|50|12|5|0|10|25|1 pack
Edamame, roasted|Snacks|420|40|30|15|15|3|30|
Protein chips|Snacks|420|40|35|13|5|3|30|1 bag
Mixed nuts, unsalted|Nüsse|610|19|15|52|8|4|30|1 handful
Pecans|Nüsse|691|9|14|72|9.6|4|30|
Pine nuts|Nüsse|673|14|13|68|3.7|3.6|10|
Hemp seeds|Nüsse|553|32|9|49|4|1.5|15|1 tbsp
Mango, dried|Trockenobst|320|2.5|78|1|2.5|66|30|
Banana chips|Trockenobst|519|2.3|58|34|7.7|35|30|
Physalis (golden berry)|Obst|53|1.9|11|0.7|1|0|50|
Lychee|Obst|66|0.8|17|0.4|1.3|15|100|
Papaya|Obst|43|0.5|11|0.3|1.7|8|150|
Passion fruit|Obst|97|2.2|23|0.7|10|11|20|1 fruit
Clementine|Obst|47|0.9|12|0.2|1.7|9|75|1 clementine
Rhubarb|Gemüse|21|0.9|4.5|0.2|1.8|1.1|100|
Bok choy|Gemüse|13|1.5|2.2|0.2|1|1.2|150|
Napa cabbage|Gemüse|16|1.2|3.2|0.2|1.2|1.4|150|
Savoy cabbage|Gemüse|27|2|6|0.1|3.1|2.3|150|
Parsnip|Gemüse|75|1.2|18|0.3|4.9|4.8|150|
Rutabaga|Gemüse|37|1.1|8.6|0.2|2.3|4.5|150|
Jerusalem artichoke|Gemüse|73|2|17|0|1.6|9.6|100|
Artichoke hearts|Gemüse|47|3.3|10|0.2|5.4|1|100|
Capers|Gemüse|23|2.4|4.9|0.9|3.2|0.4|10|
Sun-dried tomatoes in oil|Gemüse|213|5|23|14|5.8|15|20|
Jalapeños|Gemüse|29|0.9|6.5|0.4|2.8|4|20|
Kimchi|Gemüse|23|1.1|4|0.5|1.6|1.1|100|
Soybean sprouts|Gemüse|30|3|5.9|0.2|1.8|4|100|
Seaweed (nori)|Gemüse|35|5.8|5.1|0.3|0.3|0.5|3|1 sheet
Coconut milk|Fette|197|2|2.8|21|0|2|100|
Coconut milk, light|Fette|73|0.7|1.8|7|0|1.5|100|
Multigrain roll|Brot|265|10|45|5|6|2|65|1 roll
Tuna sandwich|Gerichte|230|11|24|10|2|2.5|180|1 sandwich
Potato soup with sausage|Gerichte|95|4|9|5|1|1|400|1 plate
Goulash soup|Gerichte|65|5|5|3|0.8|1.5|400|1 plate
Minestrone|Gerichte|40|1.8|6|1|1.5|2|400|1 plate
Pumpkin soup|Gerichte|55|1|6|3|1.2|3|400|1 plate
Lentil dal|Gerichte|120|6|15|4|4|2|350|
Falafel wrap|Gerichte|230|7|29|10|4|3|300|1 wrap
Quark balls (fried dough)|Süßes|370|7|45|18|1|18|25|1 piece
Cheese roll, baked|Gerichte|300|12|32|13|2|2|90|1 roll
Fish sandwich (pickled herring)|Gerichte|255|10|22|14|1.5|3|150|1 roll
Fried fish (battered)|Gerichte|230|14|14|13|0.8|0.8|150|
Salmon fillet, pan-fried|Fisch|206|22|0|13|0|0|125|1 fillet
Pickled herring (Matjes)|Fisch|260|16|0|22|0|0|50|1 fillet
Calamari, fried|Fisch|215|12|17|11|1|0.5|100|
Mussels|Fisch|86|12|3.7|2.2|0|0|200|
Tuna steak|Fisch|130|28|0|1.3|0|0|150|
Pike-perch|Fisch|84|19|0|0.7|0|0|150|
Smoked tofu, sliced|Hülsenfrüchte|170|17|2|10|2|1|20|1 slice
White wine spritzer|Getränke|40|0|1.3|0|0|0.5|250|1 glass
Shandy (Radler)|Getränke|39|0.3|6|0|0|5.5|500|1 bottle 0.5 l
Wheat beer|Getränke|45|0.5|3.5|0|0|0|500|1 bottle 0.5 l
Aperol spritz|Getränke|90|0|9|0|0|8|200|1 glass
Gin and tonic|Getränke|85|0|7|0|0|7|250|1 glass
Vodka|Getränke|231|0|0|0|0|0|20|1 shot
Cola-orange soda (Spezi)|Getränke|42|0|10.5|0|0|10.5|500|1 bottle
Mate soda|Getränke|26|0|6.5|0|0|6.5|500|1 bottle
Sports drink|Getränke|25|0|6|0|0|5.5|500|1 bottle
Coconut water|Getränke|19|0.7|3.7|0.2|1.1|2.6|330|
Vegetable juice|Getränke|22|0.9|4|0.2|0.9|3|250|1 glass
Multivitamin juice|Getränke|50|0.3|11.5|0.1|0.2|11|250|1 glass
Espresso|Getränke|2|0.1|0|0.2|0|0|30|1 cup
Flat white|Getränke|55|3|4.5|3|0|4.5|180|1 cup
Chai latte|Getränke|70|2.5|11|2|0|10|300|
Matcha latte|Getränke|50|2.6|6|1.8|0|5.5|300|
`.trim();

const BASE_FOODS = BASE_FOODS_RAW.split('\n').map((l, i) => {
  const [name, cat, kcal, p, c, f, fib, sug, pg, pn] = l.split('|');
  return { id: 'base:' + i, src: 'base', name, cat, n: { kcal:+kcal, p:+p, c:+c, f:+f, fib:+fib, sug:+sug, salt:0 },
    serving: +pg ? { g:+pg, label: pn || (pg + ' g') } : null };
});
