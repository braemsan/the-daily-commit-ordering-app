update public.menu_items
set
  name = 'Hot Mocha',
  description = 'Rich espresso blended with velvety chocolate and steamed milk for a smooth, comforting finish.'
where name = 'Iced Mocha';

update public.menu_items
set description = 'A refreshing blend of double espresso and sparkling water.'
where name = 'Iced Mont-Blanc';
